/**
 * Integration tests for run recovery functionality
 * Tests crash simulation, context reconstruction, and step resumption
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  PipelineExecutor,
  definePipeline,
  registry,
  detectInterruptedRuns,
  analyzeStepCompletion,
  reconstructStepContext,
  resumeRun,
  RunRecoveryOrchestrator,
  type StepContext,
  type StepResult,
} from "../src/core/index.js";
import prisma from "../src/core/prisma.js";

// Test pipeline name base
const TEST_PIPELINE_BASE = "recovery-test-pipeline";

// Generate unique pipeline name for each test
let testCounter = 0;
function getUniquePipelineName(): string {
  return `${TEST_PIPELINE_BASE}-${Date.now()}-${testCounter++}`;
}

// Track step execution for verification
let executionLog: string[] = [];

/**
 * Creates a test pipeline with configurable step behavior
 */
function createTestPipeline(stepCount: number = 3, pipelineName?: string) {
  const name = pipelineName || getUniquePipelineName();
  const steps = [];

  for (let i = 1; i <= stepCount; i++) {
    steps.push({
      name: `step${i}`,
      handler: async (ctx: StepContext): Promise<StepResult> => {
        executionLog.push(`step${i}`);
        return {
          success: true,
          data: {
            stepNumber: i,
            timestamp: new Date().toISOString(),
            prevResultCount: Object.keys(ctx.prevResults).length,
          },
        };
      },
    });
  }

  return definePipeline({
    name,
    description: "Test pipeline for recovery testing",
    steps,
  });
}

/**
 * Creates a pipeline that fails at a specific step
 */
function createFailingPipeline(failAtStep: number, totalSteps: number = 3, pipelineName?: string) {
  const name = pipelineName || getUniquePipelineName();
  const steps = [];

  for (let i = 1; i <= totalSteps; i++) {
    steps.push({
      name: `step${i}`,
      handler: async (ctx: StepContext): Promise<StepResult> => {
        executionLog.push(`step${i}`);

        if (i === failAtStep) {
          return {
            success: false,
            error: `Step ${i} intentional failure`,
          };
        }

        return {
          success: true,
          data: {
            stepNumber: i,
            timestamp: new Date().toISOString(),
          },
        };
      },
      config: {
        maxRetries: 0, // No retries for test predictability
      },
    });
  }

  return definePipeline({
    name,
    description: "Failing test pipeline",
    steps,
  });
}

/**
 * Simulates a crash by marking a run as "running" and stopping execution
 */
async function simulateCrashAtStep(
  stepName: string,
  completedSteps: string[],
  pipelineName?: string
): Promise<string> {
  const name = pipelineName || getUniquePipelineName();

  // Find or create pipeline in database
  let pipelineRecord = await prisma.pipeline.findUnique({
    where: { name },
  });

  if (!pipelineRecord) {
    pipelineRecord = await prisma.pipeline.create({
      data: {
        name,
        description: "Crashed pipeline",
      },
    });
  }

  // Create run
  const run = await prisma.run.create({
    data: {
      pipelineId: pipelineRecord.id,
      status: "running",
      startedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      triggeredBy: "test",
    },
  });

  // Create completed steps
  for (const stepName of completedSteps) {
    await prisma.step.create({
      data: {
        runId: run.id,
        name: stepName,
        status: "success",
        attemptCount: 1,
        startedAt: new Date(Date.now() - 14 * 60 * 1000),
        finishedAt: new Date(Date.now() - 13 * 60 * 1000),
        result: JSON.stringify({
          stepName,
          data: `Result from ${stepName}`,
        }),
      },
    });
  }

  // Create pending step (simulating crash during this step)
  await prisma.step.create({
    data: {
      runId: run.id,
      name: stepName,
      status: "running",
      attemptCount: 1,
      startedAt: new Date(Date.now() - 12 * 60 * 1000),
    },
  });

  return run.id;
}

describe("Run Recovery System", () => {
  beforeEach(async () => {
    // Clear execution log
    executionLog = [];

    // Clean up test data for all test pipelines
    await prisma.step.deleteMany({
      where: {
        run: {
          pipeline: {
            name: {
              startsWith: TEST_PIPELINE_BASE,
            },
          },
        },
      },
    });
    await prisma.run.deleteMany({
      where: {
        pipeline: {
          name: {
            startsWith: TEST_PIPELINE_BASE,
          },
        },
      },
    });
    await prisma.pipeline.deleteMany({
      where: {
        name: {
          startsWith: TEST_PIPELINE_BASE,
        },
      },
    });

    // Unregister test pipelines
    const allPipelines = registry.listPipelines();
    for (const pipeline of allPipelines) {
      if (pipeline.name.startsWith(TEST_PIPELINE_BASE)) {
        (registry as any).pipelines.delete(pipeline.name);
      }
    }
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.step.deleteMany({
      where: {
        run: {
          pipeline: {
            name: {
              startsWith: TEST_PIPELINE_BASE,
            },
          },
        },
      },
    });
    await prisma.run.deleteMany({
      where: {
        pipeline: {
          name: {
            startsWith: TEST_PIPELINE_BASE,
          },
        },
      },
    });
    await prisma.pipeline.deleteMany({
      where: {
        name: {
          startsWith: TEST_PIPELINE_BASE,
        },
      },
    });
  });

  describe("detectInterruptedRuns", () => {
    it("should detect runs stuck in running status", async () => {
      const pipelineName = getUniquePipelineName();
      const runId = await simulateCrashAtStep("step2", ["step1"], pipelineName);

      const interruptedRuns = await detectInterruptedRuns();

      const ourRun = interruptedRuns.find(r => r.runId === runId);
      expect(ourRun).toBeTruthy();
      expect(ourRun?.runId).toBe(runId);
      expect(ourRun?.pipelineName).toBe(pipelineName);
      expect(ourRun?.completedSteps).toEqual(["step1"]);
      expect(ourRun?.nextStepToExecute).toBe("step2");
    });

    it("should not detect recent runs as interrupted", async () => {
      // Create a run that started recently (< 10 minutes ago)
      const pipelineRecord = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
          description: "Recent run",
        },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "running",
          startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          triggeredBy: "test",
        },
      });

      const interruptedRuns = await detectInterruptedRuns();

      expect(interruptedRuns).toHaveLength(0);
    });

    it("should not detect completed runs", async () => {
      const pipelineRecord = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
          description: "Completed run",
        },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "success",
          startedAt: new Date(Date.now() - 30 * 60 * 1000),
          finishedAt: new Date(Date.now() - 20 * 60 * 1000),
          triggeredBy: "test",
        },
      });

      const interruptedRuns = await detectInterruptedRuns();

      expect(interruptedRuns).toHaveLength(0);
    });
  });

  describe("analyzeStepCompletion", () => {
    it("should correctly analyze step completion state", async () => {
      const runId = await simulateCrashAtStep("step3", ["step1", "step2"]);

      const analysis = await analyzeStepCompletion(runId);

      expect(analysis.completedSteps).toHaveLength(2);
      expect(analysis.completedSteps.map((s) => s.name)).toEqual([
        "step1",
        "step2",
      ]);
      expect(analysis.lastCompletedStep).toBe("step2");
      expect(analysis.pendingSteps).toHaveLength(1);
      expect(analysis.pendingSteps[0]?.name).toBe("step3");
      expect(analysis.failedSteps).toHaveLength(0);
    });

    it("should identify failed steps", async () => {
      const pipelineRecord = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
          description: "Failed step test",
        },
      });

      const run = await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "running",
          startedAt: new Date(Date.now() - 15 * 60 * 1000),
          triggeredBy: "test",
        },
      });

      // Add a failed step
      await prisma.step.create({
        data: {
          runId: run.id,
          name: "step1",
          status: "failed",
          attemptCount: 3,
          startedAt: new Date(Date.now() - 14 * 60 * 1000),
          finishedAt: new Date(Date.now() - 13 * 60 * 1000),
          error: "Step failed after max retries",
        },
      });

      const analysis = await analyzeStepCompletion(run.id);

      expect(analysis.failedSteps).toHaveLength(1);
      expect(analysis.failedSteps[0]?.name).toBe("step1");
      expect(analysis.failedSteps[0]?.attemptCount).toBe(3);
    });
  });

  describe("reconstructStepContext", () => {
    it("should reconstruct context from completed steps", async () => {
      const pipelineRecord = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
          description: "Context reconstruction test",
        },
      });

      const run = await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "running",
          startedAt: new Date(),
          triggeredBy: "test",
        },
      });

      // Create completed steps with results
      await prisma.step.create({
        data: {
          runId: run.id,
          name: "step1",
          status: "success",
          attemptCount: 1,
          startedAt: new Date(),
          finishedAt: new Date(),
          result: JSON.stringify({ value: 42 }),
        },
      });

      await prisma.step.create({
        data: {
          runId: run.id,
          name: "step2",
          status: "success",
          attemptCount: 1,
          startedAt: new Date(),
          finishedAt: new Date(),
          result: JSON.stringify({ value: 84 }),
        },
      });

      const context = await reconstructStepContext(
        run.id,
        pipelineRecord.id,
        { testMetadata: "value" }
      );

      expect(context.runId).toBe(run.id);
      expect(context.pipelineId).toBe(pipelineRecord.id);
      expect(context.metadata).toEqual({ testMetadata: "value" });
      expect(Object.keys(context.prevResults)).toHaveLength(2);
      expect(context.prevResults["step1"]).toEqual({
        success: true,
        data: { value: 42 },
      });
      expect(context.prevResults["step2"]).toEqual({
        success: true,
        data: { value: 84 },
      });
    });
  });

  describe("resumeRun", () => {
    it("should resume execution from last successful step", async () => {
      // Create unique name for pipeline
      const pipelineName = getUniquePipelineName();

      // Register test pipeline
      const pipeline = createTestPipeline(3, pipelineName);
      registry.registerPipeline(pipeline);

      // Simulate crash after step1 with same pipeline name
      const runId = await simulateCrashAtStep("step2", ["step1"], pipelineName);

      // Resume the run
      const result = await resumeRun(runId);

      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toBe(2); // step2 and step3
      expect(executionLog).toEqual(["step2", "step3"]);

      // Verify run is marked as success
      const run = await prisma.run.findUnique({
        where: { id: runId },
      });
      expect(run?.status).toBe("success");
      expect(run?.finishedAt).toBeTruthy();
    });

    it("should not resume if run has failed steps", async () => {
      const pipelineName = getUniquePipelineName();
      const pipeline = createTestPipeline(3, pipelineName);
      registry.registerPipeline(pipeline);

      // Create run with failed step - use same pipeline name
      const pipelineRecord = await prisma.pipeline.create({
        data: {
          name: pipelineName,
          description: "Failed step test",
        },
      });

      const run = await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "running",
          startedAt: new Date(Date.now() - 15 * 60 * 1000),
          triggeredBy: "test",
        },
      });

      await prisma.step.create({
        data: {
          runId: run.id,
          name: "step1",
          status: "failed",
          attemptCount: 3,
          startedAt: new Date(),
          finishedAt: new Date(),
          error: "Intentional failure",
        },
      });

      const result = await resumeRun(run.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain("failed step");
      expect(executionLog).toHaveLength(0); // No steps executed
    });

    it("should handle run not found", async () => {
      const result = await resumeRun("nonexistent-run-id");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should handle pipeline not in registry", async () => {
      const runId = await simulateCrashAtStep("step2", ["step1"]);
      // Don't register the pipeline

      const result = await resumeRun(runId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found in registry");
    });

    it("should skip already-completed steps", async () => {
      const pipelineName = getUniquePipelineName();
      const pipeline = createTestPipeline(4, pipelineName);
      registry.registerPipeline(pipeline);

      // Simulate crash after step2 completed
      const runId = await simulateCrashAtStep("step3", ["step1", "step2"], pipelineName);

      const result = await resumeRun(runId);

      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toBe(2); // Only step3 and step4
      expect(executionLog).toEqual(["step3", "step4"]);
      expect(executionLog).not.toContain("step1");
      expect(executionLog).not.toContain("step2");
    });

    it("should reconstruct context with previous step results", async () => {
      let capturedContext: StepContext | null = null;
      const pipelineName = getUniquePipelineName();

      const pipeline = definePipeline({
        name: pipelineName,
        description: "Context verification pipeline",
        steps: [
          {
            name: "step1",
            handler: async () => ({
              success: true,
              data: { value: 100 },
            }),
          },
          {
            name: "step2",
            handler: async () => ({
              success: true,
              data: { value: 200 },
            }),
          },
          {
            name: "step3",
            handler: async (ctx: StepContext) => {
              capturedContext = ctx;
              return {
                success: true,
                data: { value: 300 },
              };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      // Simulate crash after step2 - use same pipeline name
      const pipelineRecord = await prisma.pipeline.create({
        data: {
          name: pipelineName,
        },
      });

      const run = await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "running",
          startedAt: new Date(Date.now() - 15 * 60 * 1000),
          triggeredBy: "test",
        },
      });

      await prisma.step.create({
        data: {
          runId: run.id,
          name: "step1",
          status: "success",
          attemptCount: 1,
          startedAt: new Date(),
          finishedAt: new Date(),
          result: JSON.stringify({ value: 100 }),
        },
      });

      await prisma.step.create({
        data: {
          runId: run.id,
          name: "step2",
          status: "success",
          attemptCount: 1,
          startedAt: new Date(),
          finishedAt: new Date(),
          result: JSON.stringify({ value: 200 }),
        },
      });

      await prisma.step.create({
        data: {
          runId: run.id,
          name: "step3",
          status: "running",
          attemptCount: 1,
          startedAt: new Date(),
        },
      });

      await resumeRun(run.id);

      expect(capturedContext).toBeTruthy();
      expect(capturedContext?.prevResults["step1"]).toEqual({
        success: true,
        data: { value: 100 },
      });
      expect(capturedContext?.prevResults["step2"]).toEqual({
        success: true,
        data: { value: 200 },
      });
    });
  });

  describe("RunRecoveryOrchestrator", () => {
    it("should recover multiple interrupted runs", async () => {
      const pipelineName = getUniquePipelineName();
      const pipeline = createTestPipeline(3, pipelineName);
      registry.registerPipeline(pipeline);

      // Create multiple interrupted runs with same pipeline
      const runId1 = await simulateCrashAtStep("step2", ["step1"], pipelineName);
      const runId2 = await simulateCrashAtStep("step3", ["step1", "step2"], pipelineName);

      const orchestrator = new RunRecoveryOrchestrator();
      const result = await orchestrator.recoverInterruptedRuns();

      expect(result.detected).toBe(2);
      expect(result.recovered).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify both runs completed
      const run1 = await prisma.run.findUnique({ where: { id: runId1 } });
      const run2 = await prisma.run.findUnique({ where: { id: runId2 } });

      expect(run1?.status).toBe("success");
      expect(run2?.status).toBe("success");
    });

    it("should report failures for runs that cannot be recovered", async () => {
      const pipeline = createTestPipeline(3);
      registry.registerPipeline(pipeline);

      // Create run with failed step
      const pipelineRecord = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
        },
      });

      const run = await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "running",
          startedAt: new Date(Date.now() - 15 * 60 * 1000),
          triggeredBy: "test",
        },
      });

      await prisma.step.create({
        data: {
          runId: run.id,
          name: "step1",
          status: "failed",
          attemptCount: 3,
          startedAt: new Date(),
          finishedAt: new Date(),
          error: "Cannot recover",
        },
      });

      const orchestrator = new RunRecoveryOrchestrator();
      const result = await orchestrator.recoverInterruptedRuns();

      expect(result.detected).toBe(1);
      expect(result.recovered).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.runId).toBe(run.id);
    });

    it("should handle runs with no remaining steps", async () => {
      const pipelineName = getUniquePipelineName();
      const pipeline = createTestPipeline(2, pipelineName);
      registry.registerPipeline(pipeline);

      // Create run where all steps completed but run status is still "running"
      const pipelineRecord = await prisma.pipeline.create({
        data: {
          name: pipelineName,
        },
      });

      const run = await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "running",
          startedAt: new Date(Date.now() - 15 * 60 * 1000),
          triggeredBy: "test",
        },
      });

      await prisma.step.create({
        data: {
          runId: run.id,
          name: "step1",
          status: "success",
          attemptCount: 1,
          startedAt: new Date(),
          finishedAt: new Date(),
          result: JSON.stringify({ data: "step1" }),
        },
      });

      await prisma.step.create({
        data: {
          runId: run.id,
          name: "step2",
          status: "success",
          attemptCount: 1,
          startedAt: new Date(),
          finishedAt: new Date(),
          result: JSON.stringify({ data: "step2" }),
        },
      });

      const orchestrator = new RunRecoveryOrchestrator();
      const result = await orchestrator.recoverInterruptedRuns();

      expect(result.detected).toBe(1);
      expect(result.recovered).toBe(1);
      expect(result.failed).toBe(0);

      // Verify run is marked as success
      const updatedRun = await prisma.run.findUnique({
        where: { id: run.id },
      });
      expect(updatedRun?.status).toBe("success");
    });
  });

  describe("Idempotent Step Design", () => {
    it("should handle re-execution of idempotent steps safely", async () => {
      let executionCount = 0;

      const pipeline = definePipeline({
        name: getUniquePipelineName(),
        description: "Idempotent test pipeline",
        steps: [
          {
            name: "idempotent-step",
            handler: async (ctx: StepContext) => {
              executionCount++;

              // Idempotent operation: check if already done
              const previousResult = ctx.prevResults["idempotent-step"];
              if (previousResult && previousResult.success) {
                // Return same result without side effects
                return previousResult as StepResult;
              }

              return {
                success: true,
                data: { operationId: "unique-id-123" },
              };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      // First execution
      const executor = new PipelineExecutor(pipeline);
      await executor.execute();

      expect(executionCount).toBe(1);

      // This demonstrates how steps should be designed to be safely re-executable
    });
  });
});
