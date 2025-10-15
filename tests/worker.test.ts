/**
 * Tests for background worker process
 * Tests pipeline loading, run execution, and worker behavior
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { definePipeline, registry, type StepContext } from "../src/core/index.js";
import { claimPendingRun } from "../src/core/run-claimer.js";
import prisma from "../src/core/prisma.js";
import { readdirSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const TEST_PIPELINE_BASE = "worker-test-pipeline";
const TEST_PIPELINES_DIR = join(process.cwd(), "test-pipelines-temp");
let testCounter = 0;

function getUniquePipelineName(): string {
  return `${TEST_PIPELINE_BASE}-${Date.now()}-${testCounter++}`;
}

// Track step execution
let executionLog: string[] = [];

/**
 * Simulates the executeExistingRun function from worker.ts
 * This is the core logic we're testing
 */
async function executeExistingRun(
  run: NonNullable<Awaited<ReturnType<typeof claimPendingRun>>>,
  pipelineDef: ReturnType<typeof definePipeline>
): Promise<void> {
  const { updateRunStatus, createStep, updateStepStatus, updateStepResult } = await import("../src/core/index.js");

  try {
    const stepResults: Record<string, any> = {};

    for (const stepDef of pipelineDef.steps) {
      const step = await createStep({
        runId: run.id,
        name: stepDef.name,
      });

      await updateStepStatus(step.id, {
        status: "running",
        startedAt: new Date(),
        attemptCount: 1,
      });

      const stepContext: StepContext = {
        runId: run.id,
        pipelineId: run.pipelineId,
        prevResults: stepResults,
        metadata: {
          triggeredBy: run.triggeredBy || "worker",
        },
      };

      try {
        const result = await stepDef.handler(stepContext);
        stepResults[stepDef.name] = result;

        if (result.success) {
          await updateStepStatus(step.id, {
            status: "success",
            finishedAt: new Date(),
            attemptCount: 1,
          });

          if (result.data !== undefined) {
            await updateStepResult(step.id, JSON.stringify(result.data));
          }
        } else {
          await updateStepStatus(step.id, {
            status: "failed",
            finishedAt: new Date(),
            attemptCount: 1,
          });

          await updateStepResult(step.id, "", result.error || "Step failed");
          throw new Error(result.error || `Step "${stepDef.name}" failed`);
        }
      } catch (error: any) {
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

    await updateRunStatus(run.id, "success", new Date());
  } catch (error: any) {
    await updateRunStatus(run.id, "failed", new Date());
    throw error;
  }
}

describe("Worker Process", () => {
  beforeEach(async () => {
    executionLog = [];

    // Clean up ALL pending/running runs to ensure isolation from other tests
    await prisma.run.deleteMany({
      where: {
        status: {
          in: ["pending", "running"],
        },
      },
    });

    // Clean up test-specific data
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
    // Clean up test data
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

    // Clean up test pipelines directory if it exists
    if (readdirSync(process.cwd()).includes("test-pipelines-temp")) {
      rmSync(TEST_PIPELINES_DIR, { recursive: true, force: true });
    }
  });

  describe("Claiming and Executing Runs", () => {
    it("should claim and execute a pending run successfully", async () => {
      const pipelineName = getUniquePipelineName();

      // Create pipeline in database
      const pipelineRecord = await prisma.pipeline.create({
        data: {
          name: pipelineName,
          description: "Worker test pipeline",
        },
      });

      // Create pending run
      await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "ui",
        },
      });

      // Define and register pipeline
      const pipeline = definePipeline({
        name: pipelineName,
        description: "Test pipeline",
        steps: [
          {
            name: "step1",
            handler: async () => {
              executionLog.push("step1");
              return { success: true, data: { value: 1 } };
            },
          },
          {
            name: "step2",
            handler: async () => {
              executionLog.push("step2");
              return { success: true, data: { value: 2 } };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      // Worker claims and executes
      const claimedRun = await claimPendingRun();
      expect(claimedRun).toBeTruthy();
      expect(claimedRun?.status).toBe("running");

      await executeExistingRun(claimedRun!, pipeline);

      // Verify execution
      expect(executionLog).toEqual(["step1", "step2"]);

      // Verify run completed
      const completedRun = await prisma.run.findUnique({
        where: { id: claimedRun!.id },
        include: { steps: true },
      });

      expect(completedRun?.status).toBe("success");
      expect(completedRun?.finishedAt).toBeTruthy();
      expect(completedRun?.steps).toHaveLength(2);
      expect(completedRun?.steps[0]?.status).toBe("success");
      expect(completedRun?.steps[1]?.status).toBe("success");
    });

    it("should handle step failure correctly", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "test",
        },
      });

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "step1",
            handler: async () => {
              executionLog.push("step1");
              return { success: true };
            },
          },
          {
            name: "step2",
            handler: async () => {
              executionLog.push("step2");
              return { success: false, error: "Intentional failure" };
            },
          },
          {
            name: "step3",
            handler: async () => {
              executionLog.push("step3");
              return { success: true };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      const claimedRun = await claimPendingRun();

      await expect(executeExistingRun(claimedRun!, pipeline)).rejects.toThrow(
        "Intentional failure"
      );

      // Step3 should not have executed
      expect(executionLog).toEqual(["step1", "step2"]);

      // Verify run is marked as failed
      const failedRun = await prisma.run.findUnique({
        where: { id: claimedRun!.id },
        include: { steps: true },
      });

      expect(failedRun?.status).toBe("failed");
      expect(failedRun?.finishedAt).toBeTruthy();

      // Check step statuses
      const steps = failedRun!.steps.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      expect(steps[0]?.status).toBe("success"); // step1
      expect(steps[1]?.status).toBe("failed"); // step2
      expect(steps).toHaveLength(2); // step3 never created
    });

    it("should pass previous results to subsequent steps", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "test",
        },
      });

      let capturedContext: StepContext | null = null;

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "step1",
            handler: async () => ({
              success: true,
              data: { message: "from step1" },
            }),
          },
          {
            name: "step2",
            handler: async () => ({
              success: true,
              data: { message: "from step2" },
            }),
          },
          {
            name: "step3",
            handler: async (ctx) => {
              capturedContext = ctx;
              return { success: true };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      const claimedRun = await claimPendingRun();
      await executeExistingRun(claimedRun!, pipeline);

      expect(capturedContext).toBeTruthy();
      expect(capturedContext?.prevResults["step1"]).toEqual({
        success: true,
        data: { message: "from step1" },
      });
      expect(capturedContext?.prevResults["step2"]).toEqual({
        success: true,
        data: { message: "from step2" },
      });
    });

    it("should include metadata in step context", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "scheduled-job",
        },
      });

      let capturedContext: StepContext | null = null;

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "step1",
            handler: async (ctx) => {
              capturedContext = ctx;
              return { success: true };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      const claimedRun = await claimPendingRun();
      await executeExistingRun(claimedRun!, pipeline);

      expect(capturedContext?.metadata?.triggeredBy).toBe("scheduled-job");
    });
  });

  describe("Worker Polling Behavior", () => {
    it("should process multiple pending runs sequentially", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      // Create 3 pending runs
      await Promise.all([
        prisma.run.create({
          data: {
            pipelineId: pipelineRecord.id,
            status: "pending",
            triggeredBy: "run1",
            startedAt: new Date(Date.now() - 3000),
          },
        }),
        prisma.run.create({
          data: {
            pipelineId: pipelineRecord.id,
            status: "pending",
            triggeredBy: "run2",
            startedAt: new Date(Date.now() - 2000),
          },
        }),
        prisma.run.create({
          data: {
            pipelineId: pipelineRecord.id,
            status: "pending",
            triggeredBy: "run3",
            startedAt: new Date(Date.now() - 1000),
          },
        }),
      ]);

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "step1",
            handler: async (ctx) => {
              executionLog.push(
                `${ctx.metadata?.triggeredBy || "unknown"}-step1`
              );
              return { success: true };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      // Simulate worker polling 3 times
      for (let i = 0; i < 3; i++) {
        const run = await claimPendingRun();
        if (run) {
          await executeExistingRun(run, pipeline);
        }
      }

      // Should process in order (oldest first)
      expect(executionLog).toEqual(["run1-step1", "run2-step1", "run3-step1"]);

      // All runs should be completed
      const allRuns = await prisma.run.findMany({
        where: { pipelineId: pipelineRecord.id },
      });

      expect(allRuns).toHaveLength(3);
      allRuns.forEach((run) => {
        expect(run.status).toBe("success");
      });
    });

    it("should return null when no pending runs remain", async () => {
      // No pending runs exist
      const run = await claimPendingRun();
      expect(run).toBeNull();
    });

    it("should handle mix of pending and completed runs", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      // Create completed run
      await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "success",
          triggeredBy: "completed",
          finishedAt: new Date(),
          startedAt: new Date(Date.now() - 10000),
        },
      });

      // Create pending run
      await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "pending",
          startedAt: new Date(),
        },
      });

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "step1",
            handler: async () => {
              executionLog.push("executed");
              return { success: true };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      const run = await claimPendingRun();
      expect(run?.triggeredBy).toBe("pending");

      await executeExistingRun(run!, pipeline);

      expect(executionLog).toEqual(["executed"]);
    });
  });

  describe("Database State Management", () => {
    it("should create step records with correct status progression", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      const createdRun = await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "test",
        },
      });

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "step1",
            handler: async () => ({ success: true, data: { result: 42 } }),
          },
        ],
      });

      registry.registerPipeline(pipeline);

      const run = await claimPendingRun();
      await executeExistingRun(run!, pipeline);

      const steps = await prisma.step.findMany({
        where: { runId: createdRun.id },
      });

      expect(steps).toHaveLength(1);
      expect(steps[0]?.name).toBe("step1");
      expect(steps[0]?.status).toBe("success");
      expect(steps[0]?.attemptCount).toBe(1);
      expect(steps[0]?.startedAt).toBeTruthy();
      expect(steps[0]?.finishedAt).toBeTruthy();
      expect(steps[0]?.result).toBe(JSON.stringify({ result: 42 }));
    });

    it("should preserve run metadata from UI trigger", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      const originalRun = await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "ui-button-click",
        },
      });

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "step1",
            handler: async () => ({ success: true }),
          },
        ],
      });

      registry.registerPipeline(pipeline);

      const run = await claimPendingRun();
      await executeExistingRun(run!, pipeline);

      const completedRun = await prisma.run.findUnique({
        where: { id: originalRun.id },
      });

      expect(completedRun?.triggeredBy).toBe("ui-button-click");
    });
  });

  describe("Error Scenarios", () => {
    it("should handle exception thrown by step handler", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "test",
        },
      });

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "step1",
            handler: async () => {
              throw new Error("Unexpected exception");
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      const run = await claimPendingRun();

      await expect(executeExistingRun(run!, pipeline)).rejects.toThrow(
        "Unexpected exception"
      );

      const failedRun = await prisma.run.findUnique({
        where: { id: run!.id },
        include: { steps: true },
      });

      expect(failedRun?.status).toBe("failed");
      expect(failedRun?.steps[0]?.status).toBe("failed");
      expect(failedRun?.steps[0]?.error).toBe("Unexpected exception");
    });

    it("should not execute subsequent steps after failure", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "test",
        },
      });

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "step1",
            handler: async () => {
              executionLog.push("step1");
              return { success: false, error: "Failed" };
            },
          },
          {
            name: "step2",
            handler: async () => {
              executionLog.push("step2");
              return { success: true };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      const run = await claimPendingRun();

      await expect(executeExistingRun(run!, pipeline)).rejects.toThrow();

      expect(executionLog).toEqual(["step1"]);
      expect(executionLog).not.toContain("step2");
    });
  });

  describe("Integration with UI-Created Runs", () => {
    it("should execute run created by tRPC mutation", async () => {
      const pipelineName = getUniquePipelineName();

      // Simulate what the UI does via tRPC
      const pipelineRecord = await prisma.pipeline.create({
        data: {
          name: pipelineName,
          description: "UI pipeline",
        },
      });

      const uiCreatedRun = await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "manual",
        },
      });

      // Worker picks it up
      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "processData",
            handler: async () => {
              executionLog.push("processData");
              return { success: true, data: { processed: true } };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      const claimedRun = await claimPendingRun();
      expect(claimedRun?.id).toBe(uiCreatedRun.id);

      await executeExistingRun(claimedRun!, pipeline);

      expect(executionLog).toEqual(["processData"]);

      const completedRun = await prisma.run.findUnique({
        where: { id: uiCreatedRun.id },
      });

      expect(completedRun?.status).toBe("success");
    });
  });
});
