#!/usr/bin/env node
/**
 * Orbit Background Worker
 * Continuously polls the database for pending pipeline runs and executes them
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readdirSync } from "fs";
import {
  registry,
  type PipelineDefinition,
  logger,
  createLogger,
  recordRun,
  startMetricsReporting,
  stopMetricsReporting,
} from "./core/index.js";
import { claimPendingRun } from "./core/run-claimer.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "5000", 10);
const METRICS_INTERVAL = parseInt(process.env.METRICS_INTERVAL || "60000", 10); // 1 minute default

// Shutdown flag
let isShuttingDown = false;

/**
 * Pipeline Loader
 * Discovers and loads pipelines from the pipelines directory
 */
class PipelineLoader {
  private pipelinesDir: string;

  constructor(pipelinesDir?: string) {
    this.pipelinesDir = pipelinesDir || join(__dirname, "pipelines");
  }

  /**
   * Discovers all pipeline files in the pipelines directory
   */
  async discoverPipelines(): Promise<string[]> {
    try {
      const files = readdirSync(this.pipelinesDir);
      return files.filter(
        (file) =>
          (file.endsWith(".js") || file.endsWith(".ts")) &&
          !file.endsWith(".d.ts")
      );
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Loads a specific pipeline file
   */
  async loadPipeline(filename: string): Promise<PipelineDefinition | null> {
    try {
      const filepath = join(this.pipelinesDir, filename);
      const module = await import(filepath);

      // Look for default export or named 'pipeline' export
      const pipeline = module.default || module.pipeline;

      if (!pipeline) {
        logger.warn(
          `File ${filename} does not export a pipeline (use default export or named 'pipeline' export)`
        );
        return null;
      }

      // Validate it's a pipeline definition
      if (
        !pipeline.name ||
        !pipeline.steps ||
        !Array.isArray(pipeline.steps)
      ) {
        logger.warn(`File ${filename} does not export a valid pipeline`);
        return null;
      }

      return pipeline;
    } catch (error: any) {
      logger.error(`Failed to load pipeline ${filename}`, error);
      return null;
    }
  }

  /**
   * Loads all pipelines and registers them
   */
  async loadAllPipelines(): Promise<number> {
    const files = await this.discoverPipelines();

    if (files.length === 0) {
      logger.warn(`No pipeline files found in ${this.pipelinesDir}`);
      return 0;
    }

    let loadedCount = 0;

    for (const file of files) {
      const pipeline = await this.loadPipeline(file);
      if (pipeline) {
        try {
          registry.registerPipeline(pipeline);
          logger.info(`Loaded pipeline: ${pipeline.name}`);
          loadedCount++;
        } catch (error: any) {
          logger.error(
            `Failed to register pipeline ${pipeline.name}`,
            error
          );
        }
      }
    }

    return loadedCount;
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validates environment configuration
 */
function validateEnvironment() {
  if (!process.env.DATABASE_URL) {
    logger.error("DATABASE_URL environment variable is not set");
    logger.info("Please set DATABASE_URL in your .env file");
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`, { signal });
    isShuttingDown = true;

    // Stop metrics reporting
    stopMetricsReporting();

    // Give in-flight execution time to complete (30 seconds max)
    setTimeout(() => {
      logger.warn("Force shutdown after timeout");
      process.exit(1);
    }, 30000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

/**
 * Execute an existing run (that was claimed from the database)
 * This is different from PipelineExecutor.execute() which creates a new run.
 */
async function executeExistingRun(
  run: Awaited<ReturnType<typeof claimPendingRun>> & { pipeline: { name: string } },
  pipeline: PipelineDefinition
): Promise<void> {
  const { PipelineExecutor: _, updateRunStatus, createStep, updateStepStatus, updateStepResult } = await import("./core/index.js");

  // Create context-aware logger for this run
  const runLogger = createLogger({
    runId: run.id,
    pipelineId: run.pipelineId,
    pipelineName: run.pipeline.name,
  });

  runLogger.info("Starting run execution");

  try {
    // Build initial step context
    const stepResults: Record<string, any> = {};

    // Execute each step sequentially
    for (const stepDef of pipeline.steps) {
      runLogger.info(`Executing step: ${stepDef.name}`, { stepName: stepDef.name });

      // Create step record
      const step = await createStep({
        runId: run.id,
        name: stepDef.name,
      });

      await updateStepStatus(step.id, {
        status: "running",
        startedAt: new Date(),
        attemptCount: 1,
      });

      // Build step context
      const stepContext = {
        runId: run.id,
        pipelineId: run.pipelineId,
        prevResults: stepResults,
        metadata: {
          triggeredBy: run.triggeredBy || "worker",
        },
      };

      try {
        // Execute step handler
        const result = await stepDef.handler(stepContext);

        // Store result for next steps
        stepResults[stepDef.name] = result;

        if (result.success) {
          // Mark step as successful
          runLogger.info(`Step completed successfully: ${stepDef.name}`, {
            stepName: stepDef.name,
            hasData: result.data !== undefined
          });

          await updateStepStatus(step.id, {
            status: "success",
            finishedAt: new Date(),
            attemptCount: 1,
          });

          if (result.data !== undefined) {
            await updateStepResult(step.id, JSON.stringify(result.data));
          }
        } else {
          // Step returned failure
          runLogger.error(`Step failed: ${stepDef.name}`, undefined, {
            stepName: stepDef.name,
            error: result.error,
          });

          await updateStepStatus(step.id, {
            status: "failed",
            finishedAt: new Date(),
            attemptCount: 1,
          });

          await updateStepResult(step.id, "", result.error || "Step failed");
          throw new Error(result.error || `Step "${stepDef.name}" failed`);
        }
      } catch (error: any) {
        // Exception during execution
        runLogger.error(`Step threw exception: ${stepDef.name}`, error, {
          stepName: stepDef.name,
        });

        await updateStepStatus(step.id, {
          status: "failed",
          finishedAt: new Date(),
          attemptCount: 1,
        });

        const errorMessage = error instanceof Error ? error.message : String(error);
        await updateStepResult(step.id, "", errorMessage);
        throw error;
      }
    }

    // All steps completed successfully
    await updateRunStatus(run.id, "success", new Date());
    runLogger.info("Run completed successfully");
  } catch (error: any) {
    // Mark run as failed
    await updateRunStatus(run.id, "failed", new Date());
    runLogger.error("Run failed", error);
    throw error;
  }
}

/**
 * Main worker loop
 */
async function runWorker() {
  // Validate environment
  validateEnvironment();

  // Setup graceful shutdown
  setupGracefulShutdown();

  // Log worker startup
  logger.info("Worker process starting", {
    pollInterval: POLL_INTERVAL,
    nodeVersion: process.version,
    pid: process.pid,
  });

  // Load pipelines
  logger.info("Loading pipelines...");
  const loader = new PipelineLoader();
  const loadedCount = await loader.loadAllPipelines();

  if (loadedCount === 0) {
    logger.error("No pipelines loaded, exiting");
    process.exit(1);
  }

  logger.info(`Worker initialized successfully`, {
    pipelinesLoaded: loadedCount,
    pollInterval: POLL_INTERVAL,
    metricsInterval: METRICS_INTERVAL,
  });

  // Start metrics reporting
  startMetricsReporting(METRICS_INTERVAL);

  // Main polling loop
  while (!isShuttingDown) {
    try {
      // Attempt to claim a pending run
      const run = await claimPendingRun();

      if (!run) {
        // No pending runs, sleep and continue
        await sleep(POLL_INTERVAL);
        continue;
      }

      logger.info("Claimed pending run", {
        runId: run.id,
        pipelineId: run.pipelineId,
        pipelineName: run.pipeline.name,
        triggeredBy: run.triggeredBy,
      });

      // Get pipeline from registry
      const pipeline = registry.getPipeline(run.pipeline.name);

      if (!pipeline) {
        logger.error("Pipeline not found in registry", {
          runId: run.id,
          pipelineName: run.pipeline.name,
        });
        await sleep(POLL_INTERVAL);
        continue;
      }

      // Execute the run
      const startTime = Date.now();

      try {
        await executeExistingRun(run, pipeline);
        const duration = Date.now() - startTime;

        // Record metrics
        recordRun(duration, true);

        logger.info("Run execution completed", {
          runId: run.id,
          pipelineId: run.pipelineId,
          pipelineName: run.pipeline.name,
          durationMs: duration,
        });
      } catch (error) {
        const duration = Date.now() - startTime;

        // Record failed run metrics
        recordRun(duration, false);

        throw error; // Re-throw to be caught by outer catch
      }
    } catch (error: any) {
      logger.error("Worker error during execution", error);
      // Continue polling after error
      await sleep(POLL_INTERVAL);
    }
  }

  logger.info("Worker shutdown complete", {
    pid: process.pid,
  });
  process.exit(0);
}

// Run worker
runWorker().catch((error) => {
  logger.error("Fatal worker error", error);
  process.exit(1);
});
