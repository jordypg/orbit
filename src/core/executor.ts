/**
 * Pipeline Executor
 * Executes pipeline steps sequentially with state persistence and error handling
 */

import type {
  PipelineDefinition,
  StepContext,
  StepResult,
  StepDefinition,
} from "./types.js";
import prisma from "./prisma.js";
import { createRun, updateRunStatus, createStep, updateStepStatus, updateStepResult } from "./db-operations.js";

/**
 * Maximum number of retry attempts for a failed step
 */
const MAX_RETRIES = 3;

/**
 * Base delay multiplier for testing (can be overridden via env var)
 * Set RETRY_DELAY_MULTIPLIER=0.001 for fast tests (converts seconds to milliseconds)
 */
const DELAY_MULTIPLIER = parseFloat(process.env.RETRY_DELAY_MULTIPLIER || "1");

/**
 * Calculates exponential backoff delay in seconds
 * Formula: min(5 * 2^attempt, 300)
 * @param attempt - Current attempt number (1-based)
 * @returns Delay in seconds
 */
export function calculateBackoff(attempt: number): number {
  const baseDelay = 5; // 5 seconds
  const maxDelay = 300; // 5 minutes

  const delay = baseDelay * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Options for pipeline execution
 */
export interface ExecutionOptions {
  /** User or system identifier that triggered the execution */
  triggeredBy?: string;

  /** Additional metadata to pass to all steps */
  metadata?: Record<string, unknown>;
}

/**
 * Result of a complete pipeline execution
 */
export interface PipelineExecutionResult {
  /** ID of the run that was created */
  runId: string;

  /** Whether the entire pipeline succeeded */
  success: boolean;

  /** Results from each step */
  stepResults: Record<string, StepResult>;

  /** Error message if pipeline failed */
  error?: string;

  /** Duration of execution in milliseconds */
  duration: number;
}

/**
 * Internal execution context for a pipeline run
 */
interface ExecutionContext {
  /** ID of the run */
  runId: string;

  /** ID of the pipeline */
  pipelineId: string;

  /** Results from previous steps */
  stepResults: Record<string, StepResult>;

  /** User metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Pipeline Executor - Runs pipeline steps sequentially with database persistence
 */
export class PipelineExecutor {
  private pipeline: PipelineDefinition;

  /**
   * Creates a new pipeline executor
   * @param pipeline - Pipeline definition to execute
   * @throws Error if pipeline is invalid
   */
  constructor(pipeline: PipelineDefinition) {
    this.validatePipeline(pipeline);
    this.pipeline = pipeline;
  }

  /**
   * Validates a pipeline before execution
   * @throws Error if pipeline is invalid
   */
  private validatePipeline(pipeline: PipelineDefinition): void {
    if (!pipeline) {
      throw new Error("Pipeline is required");
    }

    if (!pipeline.name || typeof pipeline.name !== "string") {
      throw new Error("Pipeline must have a valid name");
    }

    if (!pipeline.steps || !Array.isArray(pipeline.steps)) {
      throw new Error("Pipeline must have steps array");
    }

    if (pipeline.steps.length === 0) {
      throw new Error("Pipeline must have at least one step");
    }

    // Validate each step
    for (const step of pipeline.steps) {
      if (!step.name || typeof step.name !== "string") {
        throw new Error(`Step must have a valid name`);
      }

      if (typeof step.handler !== "function") {
        throw new Error(`Step "${step.name}" must have a handler function`);
      }
    }
  }

  /**
   * Executes the pipeline
   * @param options - Execution options
   * @returns Execution result with runId and success status
   */
  async execute(options: ExecutionOptions = {}): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    let runId: string | undefined;
    let pipelineRecord: any;

    try {
      // Step 1: Get or create pipeline record in database
      pipelineRecord = await this.ensurePipelineInDatabase();

      // Step 2: Create run record
      const run = await createRun({
        pipelineId: pipelineRecord.id,
        triggeredBy: options.triggeredBy || "manual",
      });
      runId = run.id;

      // Step 3: Update run status to running
      await updateRunStatus(runId, "running");

      // Step 4: Initialize execution context
      const context: ExecutionContext = {
        runId,
        pipelineId: pipelineRecord.id,
        stepResults: {},
        metadata: options.metadata,
      };

      // Step 5: Execute steps sequentially
      await this.executeSteps(context);

      // Step 6: Mark run as successful
      await updateRunStatus(runId, "success", new Date());

      return {
        runId,
        success: true,
        stepResults: context.stepResults,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      // Mark run as failed if it was created
      if (runId) {
        try {
          await updateRunStatus(runId, "failed", new Date());
        } catch (updateError) {
          console.error("Failed to update run status:", updateError);
        }
      }

      return {
        runId: runId || "",
        success: false,
        stepResults: {},
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Ensures the pipeline exists in the database
   * Creates it if it doesn't exist
   */
  private async ensurePipelineInDatabase(): Promise<any> {
    // Try to find existing pipeline
    const existing = await prisma.pipeline.findUnique({
      where: { name: this.pipeline.name },
    });

    if (existing) {
      return existing;
    }

    // Create new pipeline
    return await prisma.pipeline.create({
      data: {
        name: this.pipeline.name,
        description: this.pipeline.description,
        schedule: this.pipeline.schedule,
      },
    });
  }

  /**
   * Builds a dependency graph for steps.
   * Steps without explicit dependencies depend on all previous steps (sequential).
   * @returns Map of step name to set of dependency step names
   */
  private buildDependencyGraph(steps: StepDefinition[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    const stepNames = steps.map(s => s.name);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;

      const dependencies = new Set<string>();

      if (step.config?.dependsOn) {
        // Explicit dependencies
        for (const dep of step.config.dependsOn) {
          if (!stepNames.includes(dep)) {
            throw new Error(
              `Step "${step.name}" depends on non-existent step "${dep}"`
            );
          }
          // Check for forward dependencies
          const depIndex = steps.findIndex(s => s.name === dep);
          if (depIndex >= i) {
            throw new Error(
              `Step "${step.name}" cannot depend on step "${dep}" which appears later in the pipeline`
            );
          }
          dependencies.add(dep);
        }
      } else {
        // No explicit dependencies: depends on all previous steps (sequential)
        for (let j = 0; j < i; j++) {
          const prevStep = steps[j];
          if (prevStep) {
            dependencies.add(prevStep.name);
          }
        }
      }

      graph.set(step.name, dependencies);
    }

    return graph;
  }


  /**
   * Executes all steps in the pipeline using dependency-based parallelism.
   * Steps with satisfied dependencies execute in parallel.
   * @throws Error if any step fails
   */
  private async executeSteps(context: ExecutionContext): Promise<void> {
    // Build dependency graph
    const graph = this.buildDependencyGraph(this.pipeline.steps);

    // Track step completion and in-flight promises
    const completed = new Set<string>();
    const failed = new Set<string>();  // Track failed steps to prevent re-launching
    const inFlightPromises = new Map<string, Promise<{ stepName: string; success: boolean; error?: Error }>>();
    let firstError: Error | null = null;

    // Helper to create a step execution promise
    const createStepPromise = (stepDef: StepDefinition): Promise<{ stepName: string; success: boolean; error?: Error }> => {
      return (async () => {
        try {
          await this.executeStep(stepDef, context);
          return { stepName: stepDef.name, success: true };
        } catch (error) {
          return {
            stepName: stepDef.name,
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      })();
    };

    // Main execution loop - continuously launch steps as dependencies are satisfied
    while (completed.size + failed.size < this.pipeline.steps.length) {
      // Get steps ready to execute (excluding failed steps)
      const inFlight = new Set(inFlightPromises.keys());
      const processedOrInflight = new Set([...completed, ...failed, ...inFlight]);
      const readySteps = this.pipeline.steps.filter(stepDef => {
        // Skip if already processed or in flight
        if (processedOrInflight.has(stepDef.name)) {
          return false;
        }

        // Check if all dependencies are completed
        const dependencies = graph.get(stepDef.name) || new Set();
        return Array.from(dependencies).every(dep => completed.has(dep));
      });

      // If we have an error, don't launch new steps - just wait for in-flight to complete
      if (!firstError) {
        // Launch all ready steps immediately
        for (const step of readySteps) {
          inFlightPromises.set(step.name, createStepPromise(step));
        }
      }

      // If no steps are in flight and not all completed, we have an error or circular dependency
      if (inFlightPromises.size === 0) {
        if (firstError) {
          throw firstError;
        }
        // No steps in flight but not all completed - circular dependency or bug
        throw new Error("Pipeline execution stalled - possible circular dependency");
      }

      // Wait for any step to complete and process it immediately
      // Create an array of promises that resolve with both the step name and result
      const promisesWithNames = Array.from(inFlightPromises.entries()).map(([name, promise]) =>
        promise.then(result => ({ name, result }))
      );

      // Race all in-flight promises and get the first one that completes
      const { name, result } = await Promise.race(promisesWithNames);

      // Immediately process the completed step
      inFlightPromises.delete(name);

      if (result.success) {
        completed.add(name);
      } else {
        // Mark as failed and record first error
        failed.add(name);
        if (!firstError && result.error) {
          firstError = result.error;
        }
      }

      // Loop continues immediately to check for new ready steps
    }

    // Check for errors after all steps complete
    if (firstError) {
      throw firstError;
    }
  }

  /**
   * Executes steps for an existing run (used by worker)
   * This allows the worker to reuse the retry logic without creating a new run
   * @internal
   */
  async _executeStepsForExistingRun(context: ExecutionContext): Promise<void> {
    await this.executeSteps(context);
  }

  /**
   * Executes a promise with an optional timeout
   * @param promise - Promise to execute
   * @param timeoutMs - Timeout in milliseconds (optional)
   * @returns The result of the promise
   * @throws Error if timeout occurs
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    if (!timeoutMs) {
      return promise;
    }

    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Step execution timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Executes a single step with retry logic
   * @throws Error if step execution fails after all retries
   */
  private async executeStep(
    stepDef: StepDefinition,
    context: ExecutionContext
  ): Promise<void> {
    // Create step record
    const step = await createStep({
      runId: context.runId,
      name: stepDef.name,
    });

    // Get max retries from step config or use default
    const maxRetries = stepDef.config?.maxRetries ?? MAX_RETRIES;
    let attemptCount = 0;

    while (attemptCount <= maxRetries) {
      attemptCount++;

      try {
        // Update step status and attempt count
        await updateStepStatus(step.id, {
          status: attemptCount === 1 ? "running" : "retrying",
          startedAt: attemptCount === 1 ? new Date() : undefined,
          attemptCount: attemptCount,
        });

        // Build step context
        const stepContext: StepContext = {
          runId: context.runId,
          pipelineId: context.pipelineId,
          prevResults: context.stepResults,
          metadata: context.metadata,
        };

        // Execute step handler with optional timeout
        const result = await this.executeWithTimeout(
          Promise.resolve(stepDef.handler(stepContext)),
          stepDef.config?.timeout
        );

        // Store step result
        context.stepResults[stepDef.name] = result;

        // If step succeeded, mark as success and return
        if (result.success) {
          await updateStepStatus(step.id, {
            status: "success",
            finishedAt: new Date(),
            attemptCount: attemptCount,
          });

          if (result.data !== undefined) {
            await updateStepResult(step.id, JSON.stringify(result.data));
          }

          return; // Success - exit retry loop
        }

        // Step returned failure
        const errorMessage = result.error || `Step "${stepDef.name}" failed`;

        // If we've exhausted retries, mark as failed and throw
        if (attemptCount > maxRetries) {
          await updateStepStatus(step.id, {
            status: "failed",
            finishedAt: new Date(),
            attemptCount: attemptCount,
          });

          await updateStepResult(step.id, "", errorMessage);
          throw new Error(errorMessage);
        }

        // Schedule retry with exponential backoff
        const backoffSeconds = calculateBackoff(attemptCount);
        const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

        await updateStepStatus(step.id, {
          status: "retrying",
          attemptCount: attemptCount,
          nextRetryAt: nextRetryAt,
        });

        await updateStepResult(step.id, "", errorMessage);

        console.log(
          `Step "${stepDef.name}" failed (attempt ${attemptCount}/${maxRetries + 1}). ` +
            `Retrying in ${backoffSeconds}s...`
        );

        // Wait for backoff period (with multiplier for testing)
        await new Promise((resolve) => setTimeout(resolve, backoffSeconds * 1000 * DELAY_MULTIPLIER));

      } catch (error) {
        // Exception thrown during execution
        const errorMessage = error instanceof Error ? error.message : String(error);

        // If we've exhausted retries, mark as failed and throw
        if (attemptCount > maxRetries) {
          await updateStepStatus(step.id, {
            status: "failed",
            finishedAt: new Date(),
            attemptCount: attemptCount,
          });

          await updateStepResult(step.id, "", errorMessage);
          throw error;
        }

        // Schedule retry with exponential backoff
        const backoffSeconds = calculateBackoff(attemptCount);
        const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

        await updateStepStatus(step.id, {
          status: "retrying",
          attemptCount: attemptCount,
          nextRetryAt: nextRetryAt,
        });

        await updateStepResult(step.id, "", errorMessage);

        console.log(
          `Step "${stepDef.name}" threw error (attempt ${attemptCount}/${maxRetries + 1}). ` +
            `Retrying in ${backoffSeconds}s...`
        );

        // Wait for backoff period (with multiplier for testing)
        await new Promise((resolve) => setTimeout(resolve, backoffSeconds * 1000 * DELAY_MULTIPLIER));
      }
    }

    // Should never reach here, but just in case
    throw new Error(`Step "${stepDef.name}" failed after ${maxRetries + 1} attempts`);
  }

  /**
   * Gets the pipeline definition
   */
  getPipeline(): PipelineDefinition {
    return this.pipeline;
  }
}
