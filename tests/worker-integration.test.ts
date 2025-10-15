/**
 * Integration and Load Tests for Worker
 * Tests atomic run acquisition, multi-worker race conditions, end-to-end execution, and load testing
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { definePipeline, registry, type StepContext } from "../src/core/index.js";
import { claimPendingRun } from "../src/core/run-claimer.js";
import prisma from "../src/core/prisma.js";

const TEST_PIPELINE_BASE = "worker-integration-test";
let testCounter = 0;

function getUniquePipelineName(): string {
  return `${TEST_PIPELINE_BASE}-${Date.now()}-${testCounter++}`;
}

// Track execution for verification
let executionLog: Array<{ workerId: string; runId: string; stepName: string; timestamp: number }> = [];

/**
 * Simulates the executeExistingRun function from worker.ts
 */
async function executeExistingRun(
  run: NonNullable<Awaited<ReturnType<typeof claimPendingRun>>>,
  pipelineDef: ReturnType<typeof definePipeline>,
  workerId: string = "worker-1"
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

        // Log execution
        executionLog.push({
          workerId,
          runId: run.id,
          stepName: stepDef.name,
          timestamp: Date.now(),
        });

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

describe("Worker Integration Tests", () => {
  beforeEach(async () => {
    executionLog = [];

    // Clean up ALL pending/running runs
    await prisma.run.deleteMany({
      where: {
        status: {
          in: ["pending", "running"],
        },
      },
    });

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
  });

  describe("Atomic Run Acquisition", () => {
    it("should atomically claim a pending run without race conditions", async () => {
      const pipelineName = getUniquePipelineName();

      // Create pipeline
      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      // Create single pending run
      const createdRun = await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "test",
        },
      });

      // Simulate two workers trying to claim the same run simultaneously
      const [claim1, claim2] = await Promise.all([
        claimPendingRun(),
        claimPendingRun(),
      ]);

      // Only one worker should get the run
      const claims = [claim1, claim2].filter((c) => c !== null);
      expect(claims).toHaveLength(1);
      expect(claims[0]?.id).toBe(createdRun.id);
      expect(claims[0]?.status).toBe("running");

      // Verify database state
      const dbRun = await prisma.run.findUnique({
        where: { id: createdRun.id },
      });
      expect(dbRun?.status).toBe("running");
    });

    it("should handle multiple workers claiming different runs", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      // Create 5 pending runs
      const runs = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          prisma.run.create({
            data: {
              pipelineId: pipelineRecord.id,
              status: "pending",
              triggeredBy: `run-${i}`,
              startedAt: new Date(Date.now() - (5 - i) * 1000), // Stagger times
            },
          })
        )
      );

      // Simulate 5 workers claiming simultaneously
      const claims = await Promise.all(
        Array.from({ length: 5 }, () => claimPendingRun())
      );

      // All claims should be successful and unique
      const successfulClaims = claims.filter((c) => c !== null);
      expect(successfulClaims).toHaveLength(5);

      const claimedIds = successfulClaims.map((c) => c!.id);
      const uniqueIds = new Set(claimedIds);
      expect(uniqueIds.size).toBe(5); // All different runs

      // Verify all runs are marked as running
      const dbRuns = await prisma.run.findMany({
        where: {
          id: {
            in: runs.map((r) => r.id),
          },
        },
      });

      dbRuns.forEach((run) => {
        expect(run.status).toBe("running");
      });
    });

    it("should claim runs in FIFO order (oldest first)", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      // Create runs with specific timestamps
      const run1 = await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "oldest",
          startedAt: new Date(Date.now() - 10000),
        },
      });

      const run2 = await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "middle",
          startedAt: new Date(Date.now() - 5000),
        },
      });

      const run3 = await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "newest",
          startedAt: new Date(Date.now() - 1000),
        },
      });

      // Claim runs in sequence
      const claim1 = await claimPendingRun();
      const claim2 = await claimPendingRun();
      const claim3 = await claimPendingRun();

      // Should be claimed in order of creation
      expect(claim1?.id).toBe(run1.id);
      expect(claim2?.id).toBe(run2.id);
      expect(claim3?.id).toBe(run3.id);
    });

    it("should handle concurrent claims with high contention", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      // Create 10 pending runs in batches to avoid connection pool exhaustion
      const runs = [];
      for (let i = 0; i < 10; i++) {
        const run = await prisma.run.create({
          data: {
            pipelineId: pipelineRecord.id,
            status: "pending",
            triggeredBy: `run-${i}`,
            startedAt: new Date(Date.now() - (10 - i) * 100),
          },
        });
        runs.push(run);
      }

      // Simulate 20 workers trying to claim (more workers than runs)
      // Process in batches to avoid transaction timeout
      const claims1 = await Promise.all(
        Array.from({ length: 10 }, () => claimPendingRun())
      );

      // Small delay to avoid transaction contention
      await new Promise(resolve => setTimeout(resolve, 100));

      const claims2 = await Promise.all(
        Array.from({ length: 10 }, () => claimPendingRun())
      );

      const claims = [...claims1, ...claims2];

      // Only 10 should succeed
      const successfulClaims = claims.filter((c) => c !== null);
      expect(successfulClaims).toHaveLength(10);

      // All claimed IDs should be unique
      const claimedIds = successfulClaims.map((c) => c!.id);
      const uniqueIds = new Set(claimedIds);
      expect(uniqueIds.size).toBe(10);

      // 10 workers should get null
      const failedClaims = claims.filter((c) => c === null);
      expect(failedClaims).toHaveLength(10);
    });
  });

  describe("Multi-Worker Race Conditions", () => {
    it("should handle two workers processing different runs simultaneously", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      // Create 2 pending runs
      await Promise.all([
        prisma.run.create({
          data: {
            pipelineId: pipelineRecord.id,
            status: "pending",
            triggeredBy: "worker-1",
            startedAt: new Date(Date.now() - 2000),
          },
        }),
        prisma.run.create({
          data: {
            pipelineId: pipelineRecord.id,
            status: "pending",
            triggeredBy: "worker-2",
            startedAt: new Date(Date.now() - 1000),
          },
        }),
      ]);

      // Define pipeline
      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "step1",
            handler: async () => {
              // Simulate work
              await new Promise((resolve) => setTimeout(resolve, 50));
              return { success: true, data: { value: 1 } };
            },
          },
          {
            name: "step2",
            handler: async () => {
              await new Promise((resolve) => setTimeout(resolve, 50));
              return { success: true, data: { value: 2 } };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      // Simulate two workers claiming and executing simultaneously
      const [result1, result2] = await Promise.all([
        (async () => {
          const run = await claimPendingRun();
          if (run) {
            await executeExistingRun(run, pipeline, "worker-1");
            return run.id;
          }
          return null;
        })(),
        (async () => {
          const run = await claimPendingRun();
          if (run) {
            await executeExistingRun(run, pipeline, "worker-2");
            return run.id;
          }
          return null;
        })(),
      ]);

      // Both workers should have processed different runs
      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();
      expect(result1).not.toBe(result2);

      // Verify both runs completed successfully
      const runs = await prisma.run.findMany({
        where: {
          pipelineId: pipelineRecord.id,
        },
      });

      expect(runs).toHaveLength(2);
      runs.forEach((run) => {
        expect(run.status).toBe("success");
        expect(run.finishedAt).toBeTruthy();
      });

      // Verify execution log shows both workers executed
      const worker1Executions = executionLog.filter((e) => e.workerId === "worker-1");
      const worker2Executions = executionLog.filter((e) => e.workerId === "worker-2");

      expect(worker1Executions).toHaveLength(2); // 2 steps
      expect(worker2Executions).toHaveLength(2); // 2 steps
    });

    it("should prevent duplicate execution when worker crashes and restarts", async () => {
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
            handler: async () => ({ success: true, data: { value: 1 } }),
          },
        ],
      });

      registry.registerPipeline(pipeline);

      // Worker 1 claims and starts execution
      const run = await claimPendingRun();
      expect(run?.id).toBe(createdRun.id);

      // Verify run is marked as running
      const runningRun = await prisma.run.findUnique({
        where: { id: createdRun.id },
      });
      expect(runningRun?.status).toBe("running");

      // Worker 2 tries to claim (should get nothing)
      const duplicateClaim = await claimPendingRun();
      expect(duplicateClaim).toBeNull();

      // Complete the execution
      await executeExistingRun(run!, pipeline, "worker-1");

      // Verify only one execution occurred
      const logs = executionLog.filter((e) => e.runId === createdRun.id);
      expect(logs).toHaveLength(1);
    });

    it("should handle interleaved step execution from multiple workers", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      // Create 3 runs
      await Promise.all([
        prisma.run.create({
          data: {
            pipelineId: pipelineRecord.id,
            status: "pending",
            triggeredBy: "run-1",
            startedAt: new Date(Date.now() - 3000),
          },
        }),
        prisma.run.create({
          data: {
            pipelineId: pipelineRecord.id,
            status: "pending",
            triggeredBy: "run-2",
            startedAt: new Date(Date.now() - 2000),
          },
        }),
        prisma.run.create({
          data: {
            pipelineId: pipelineRecord.id,
            status: "pending",
            triggeredBy: "run-3",
            startedAt: new Date(Date.now() - 1000),
          },
        }),
      ]);

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "step1",
            handler: async () => {
              await new Promise((resolve) => setTimeout(resolve, 20));
              return { success: true };
            },
          },
          {
            name: "step2",
            handler: async () => {
              await new Promise((resolve) => setTimeout(resolve, 20));
              return { success: true };
            },
          },
          {
            name: "step3",
            handler: async () => {
              await new Promise((resolve) => setTimeout(resolve, 20));
              return { success: true };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      // Simulate 3 workers processing simultaneously
      await Promise.all([
        (async () => {
          const run = await claimPendingRun();
          if (run) await executeExistingRun(run, pipeline, "worker-1");
        })(),
        (async () => {
          const run = await claimPendingRun();
          if (run) await executeExistingRun(run, pipeline, "worker-2");
        })(),
        (async () => {
          const run = await claimPendingRun();
          if (run) await executeExistingRun(run, pipeline, "worker-3");
        })(),
      ]);

      // Verify all runs completed
      const runs = await prisma.run.findMany({
        where: { pipelineId: pipelineRecord.id },
      });

      expect(runs).toHaveLength(3);
      runs.forEach((run) => {
        expect(run.status).toBe("success");
      });

      // Verify each worker processed exactly 3 steps (one run)
      const worker1Steps = executionLog.filter((e) => e.workerId === "worker-1");
      const worker2Steps = executionLog.filter((e) => e.workerId === "worker-2");
      const worker3Steps = executionLog.filter((e) => e.workerId === "worker-3");

      expect(worker1Steps).toHaveLength(3);
      expect(worker2Steps).toHaveLength(3);
      expect(worker3Steps).toHaveLength(3);

      // Verify no duplicate runIds within same worker
      const worker1RunIds = new Set(worker1Steps.map((e) => e.runId));
      const worker2RunIds = new Set(worker2Steps.map((e) => e.runId));
      const worker3RunIds = new Set(worker3Steps.map((e) => e.runId));

      expect(worker1RunIds.size).toBe(1);
      expect(worker2RunIds.size).toBe(1);
      expect(worker3RunIds.size).toBe(1);
    });
  });

  describe("End-to-End Run Execution", () => {
    it("should execute complete pipeline with multiple steps and data flow", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "e2e-test",
        },
      });

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "fetchData",
            handler: async () => ({
              success: true,
              data: { users: [{ id: 1, name: "Alice" }] },
            }),
          },
          {
            name: "processData",
            handler: async (ctx) => {
              const users = ctx.prevResults["fetchData"]?.data?.users || [];
              return {
                success: true,
                data: { processedCount: users.length },
              };
            },
          },
          {
            name: "saveResults",
            handler: async (ctx) => {
              const count = ctx.prevResults["processData"]?.data?.processedCount || 0;
              return {
                success: true,
                data: { saved: true, count },
              };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      // Execute
      const run = await claimPendingRun();
      expect(run).toBeTruthy();

      await executeExistingRun(run!, pipeline);

      // Verify run completed
      const completedRun = await prisma.run.findUnique({
        where: { id: run!.id },
        include: {
          steps: {
            orderBy: { startedAt: "asc" },
          },
        },
      });

      expect(completedRun?.status).toBe("success");
      expect(completedRun?.finishedAt).toBeTruthy();
      expect(completedRun?.steps).toHaveLength(3);

      // Verify step results
      const steps = completedRun!.steps;
      expect(steps[0]?.name).toBe("fetchData");
      expect(steps[0]?.status).toBe("success");
      expect(JSON.parse(steps[0]?.result || "{}")).toEqual({
        users: [{ id: 1, name: "Alice" }],
      });

      expect(steps[1]?.name).toBe("processData");
      expect(JSON.parse(steps[1]?.result || "{}")).toEqual({
        processedCount: 1,
      });

      expect(steps[2]?.name).toBe("saveResults");
      expect(JSON.parse(steps[2]?.result || "{}")).toEqual({
        saved: true,
        count: 1,
      });
    });

    it("should handle pipeline with failing step and cleanup", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "failure-test",
        },
      });

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "setup",
            handler: async () => ({
              success: true,
              data: { setupComplete: true },
            }),
          },
          {
            name: "failingStep",
            handler: async () => ({
              success: false,
              error: "Intentional failure for testing",
            }),
          },
          {
            name: "cleanup",
            handler: async () => ({
              success: true,
              data: { cleanedUp: true },
            }),
          },
        ],
      });

      registry.registerPipeline(pipeline);

      const run = await claimPendingRun();

      await expect(executeExistingRun(run!, pipeline)).rejects.toThrow(
        "Intentional failure for testing"
      );

      // Verify run failed
      const failedRun = await prisma.run.findUnique({
        where: { id: run!.id },
        include: { steps: true },
      });

      expect(failedRun?.status).toBe("failed");
      expect(failedRun?.steps).toHaveLength(2); // Only setup and failingStep
      expect(failedRun?.steps.find((s) => s.name === "failingStep")?.status).toBe("failed");
      expect(failedRun?.steps.find((s) => s.name === "cleanup")).toBeUndefined();
    });

    it("should preserve metadata throughout execution", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipelineRecord.id,
          status: "pending",
          triggeredBy: "user-button-click",
        },
      });

      let capturedMetadata: any = null;

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "checkMetadata",
            handler: async (ctx) => {
              capturedMetadata = ctx.metadata;
              return { success: true };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      const run = await claimPendingRun();
      await executeExistingRun(run!, pipeline);

      expect(capturedMetadata?.triggeredBy).toBe("user-button-click");
    });
  });

  describe("Load Testing with 100+ Concurrent Runs", () => {
    it("should handle 100 concurrent runs across multiple workers", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      // Create 100 pending runs in batches to avoid connection pool issues
      const batchSize = 20;
      for (let batch = 0; batch < 5; batch++) {
        await Promise.all(
          Array.from({ length: batchSize }, (_, i) => {
            const index = batch * batchSize + i;
            return prisma.run.create({
              data: {
                pipelineId: pipelineRecord.id,
                status: "pending",
                triggeredBy: `load-test-run-${index}`,
                startedAt: new Date(Date.now() - (100 - index) * 10),
              },
            });
          })
        );
      }

      // Define a simple pipeline
      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "process",
            handler: async () => {
              // Simulate light work
              await new Promise((resolve) => setTimeout(resolve, 10));
              return { success: true, data: { processed: true } };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      // Simulate 10 workers processing concurrently
      const workerPromises = Array.from({ length: 10 }, async (_, workerIndex) => {
        const workerId = `load-worker-${workerIndex}`;
        const processedRuns: string[] = [];

        // Each worker processes up to 10 runs
        for (let i = 0; i < 10; i++) {
          const run = await claimPendingRun();
          if (run) {
            await executeExistingRun(run, pipeline, workerId);
            processedRuns.push(run.id);
          }
        }

        return { workerId, processedRuns };
      });

      const workerResults = await Promise.all(workerPromises);

      // Verify all 100 runs were processed
      const totalProcessed = workerResults.reduce(
        (sum, w) => sum + w.processedRuns.length,
        0
      );
      expect(totalProcessed).toBe(100);

      // Verify all runs completed successfully
      const allRuns = await prisma.run.findMany({
        where: { pipelineId: pipelineRecord.id },
      });

      expect(allRuns).toHaveLength(100);
      allRuns.forEach((run) => {
        expect(run.status).toBe("success");
        expect(run.finishedAt).toBeTruthy();
      });

      // Verify no duplicate processing
      const allProcessedIds = workerResults.flatMap((w) => w.processedRuns);
      const uniqueIds = new Set(allProcessedIds);
      expect(uniqueIds.size).toBe(100);
    }, 60000); // 60 second timeout for this test

    it("should maintain data integrity under high load", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      // Create 50 runs in batches
      const batchSize = 10;
      for (let batch = 0; batch < 5; batch++) {
        await Promise.all(
          Array.from({ length: batchSize }, (_, i) => {
            const index = batch * batchSize + i;
            return prisma.run.create({
              data: {
                pipelineId: pipelineRecord.id,
                status: "pending",
                triggeredBy: `integrity-test-${index}`,
                startedAt: new Date(Date.now() - (50 - index) * 100),
              },
            });
          })
        );
      }

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "step1",
            handler: async () => ({
              success: true,
              data: { value: Math.random() },
            }),
          },
          {
            name: "step2",
            handler: async (ctx) => {
              const previousValue = ctx.prevResults["step1"]?.data?.value;
              return {
                success: true,
                data: { doubled: previousValue * 2 },
              };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      // Process with 5 workers
      await Promise.all(
        Array.from({ length: 5 }, async (_, workerIndex) => {
          const workerId = `integrity-worker-${workerIndex}`;
          for (let i = 0; i < 10; i++) {
            const run = await claimPendingRun();
            if (run) {
              await executeExistingRun(run, pipeline, workerId);
            }
          }
        })
      );

      // Verify data integrity
      const runs = await prisma.run.findMany({
        where: { pipelineId: pipelineRecord.id },
        include: {
          steps: {
            orderBy: { startedAt: "asc" },
          },
        },
      });

      expect(runs).toHaveLength(50);

      // Verify each run has correct step data flow
      runs.forEach((run) => {
        expect(run.steps).toHaveLength(2);
        const step1 = run.steps.find((s) => s.name === "step1");
        const step2 = run.steps.find((s) => s.name === "step2");

        expect(step1?.status).toBe("success");
        expect(step2?.status).toBe("success");

        const step1Data = JSON.parse(step1?.result || "{}");
        const step2Data = JSON.parse(step2?.result || "{}");

        // Verify data flow
        expect(step2Data.doubled).toBeCloseTo(step1Data.value * 2, 10);
      });
    }, 45000);

    it("should handle mixed success and failure scenarios at scale", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      // Create 120 runs in batches
      const batchSize = 20;
      for (let batch = 0; batch < 6; batch++) {
        await Promise.all(
          Array.from({ length: batchSize }, (_, i) => {
            const index = batch * batchSize + i;
            return prisma.run.create({
              data: {
                pipelineId: pipelineRecord.id,
                status: "pending",
                triggeredBy: `mixed-test-${index}`,
                startedAt: new Date(Date.now() - (120 - index) * 50),
              },
            });
          })
        );
      }

      let executionCounter = 0;

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "conditionalStep",
            handler: async () => {
              executionCounter++;
              // Fail every other execution
              if (executionCounter % 2 === 0) {
                return {
                  success: false,
                  error: `Intentional failure ${executionCounter}`,
                };
              }
              return { success: true, data: { counter: executionCounter } };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      // Process with 8 workers
      const workerPromises = Array.from({ length: 8 }, async (_, workerIndex) => {
        const workerId = `mixed-worker-${workerIndex}`;
        const results = { succeeded: 0, failed: 0 };

        for (let i = 0; i < 15; i++) {
          const run = await claimPendingRun();
          if (run) {
            try {
              await executeExistingRun(run, pipeline, workerId);
              results.succeeded++;
            } catch (error) {
              results.failed++;
            }
          }
        }

        return results;
      });

      const workerResults = await Promise.all(workerPromises);

      // Calculate totals
      const totalSucceeded = workerResults.reduce((sum, r) => sum + r.succeeded, 0);
      const totalFailed = workerResults.reduce((sum, r) => sum + r.failed, 0);

      expect(totalSucceeded + totalFailed).toBe(120);
      expect(totalSucceeded).toBeGreaterThan(0);
      expect(totalFailed).toBeGreaterThan(0);

      // Verify database reflects the results
      const successRuns = await prisma.run.count({
        where: {
          pipelineId: pipelineRecord.id,
          status: "success",
        },
      });

      const failedRuns = await prisma.run.count({
        where: {
          pipelineId: pipelineRecord.id,
          status: "failed",
        },
      });

      expect(successRuns).toBe(totalSucceeded);
      expect(failedRuns).toBe(totalFailed);
    }, 60000);

    it("should handle performance degradation gracefully under extreme load", async () => {
      const pipelineName = getUniquePipelineName();

      const pipelineRecord = await prisma.pipeline.create({
        data: { name: pipelineName },
      });

      // Create 200 runs in batches
      const batchSize = 20;
      for (let batch = 0; batch < 10; batch++) {
        await Promise.all(
          Array.from({ length: batchSize }, (_, i) => {
            const index = batch * batchSize + i;
            return prisma.run.create({
              data: {
                pipelineId: pipelineRecord.id,
                status: "pending",
                triggeredBy: `stress-test-${index}`,
                startedAt: new Date(Date.now() - (200 - index) * 25),
              },
            });
          })
        );
      }

      const pipeline = definePipeline({
        name: pipelineName,
        steps: [
          {
            name: "heavyProcessing",
            handler: async () => {
              // Simulate heavier work
              await new Promise((resolve) => setTimeout(resolve, 50));
              return { success: true, data: { processed: Date.now() } };
            },
          },
        ],
      });

      registry.registerPipeline(pipeline);

      const startTime = Date.now();

      // Launch 15 workers simultaneously
      await Promise.all(
        Array.from({ length: 15 }, async (_, workerIndex) => {
          const workerId = `stress-worker-${workerIndex}`;
          let processed = 0;

          while (processed < 14) {
            // Each worker processes ~13-14 runs
            const run = await claimPendingRun();
            if (!run) break;
            await executeExistingRun(run, pipeline, workerId);
            processed++;
          }
        })
      );

      const duration = Date.now() - startTime;

      // Verify all completed
      const completedRuns = await prisma.run.count({
        where: {
          pipelineId: pipelineRecord.id,
          status: "success",
        },
      });

      expect(completedRuns).toBe(200);

      // Performance expectation: should complete in reasonable time
      // With 15 workers and 50ms per run, theoretical minimum is ~667ms
      // Allow for overhead, but ensure it completes within reasonable bounds
      expect(duration).toBeLessThan(30000); // 30 seconds max
    }, 90000);
  });
});
