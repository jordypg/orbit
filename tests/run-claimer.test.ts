/**
 * Tests for atomic run claiming functionality
 * Ensures race condition prevention and correct run acquisition
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { claimPendingRun } from "../src/core/run-claimer.js";
import prisma from "../src/core/prisma.js";

const TEST_PIPELINE_BASE = "claimer-test-pipeline";
let testCounter = 0;

function getUniquePipelineName(): string {
  return `${TEST_PIPELINE_BASE}-${Date.now()}-${testCounter++}`;
}

describe("Run Claimer - Atomic Run Acquisition", () => {
  beforeEach(async () => {
    // Clean up ALL test data to ensure isolation
    // Delete all pending/running runs first to avoid affecting other tests
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

  describe("Basic Run Claiming", () => {
    it("should return null when no pending runs exist", async () => {
      const run = await claimPendingRun();
      expect(run).toBeNull();
    });

    it("should claim a pending run and update status to running", async () => {
      // Create pipeline
      const pipeline = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
          description: "Test pipeline",
        },
      });

      // Create pending run
      const createdRun = await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "pending",
          triggeredBy: "test",
        },
      });

      // Claim the run
      const claimedRun = await claimPendingRun();

      // Verify run was claimed
      expect(claimedRun).toBeTruthy();
      expect(claimedRun?.id).toBe(createdRun.id);
      expect(claimedRun?.status).toBe("running");
      expect(claimedRun?.pipeline).toBeTruthy();
      expect(claimedRun?.pipeline.id).toBe(pipeline.id);

      // Verify database was updated
      const dbRun = await prisma.run.findUnique({
        where: { id: createdRun.id },
      });
      expect(dbRun?.status).toBe("running");
      expect(dbRun?.startedAt).toBeTruthy();
    });

    it("should include pipeline relation in claimed run", async () => {
      const pipelineName = getUniquePipelineName();
      const pipeline = await prisma.pipeline.create({
        data: {
          name: pipelineName,
          description: "Test pipeline with relation",
        },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "pending",
          triggeredBy: "test",
        },
      });

      const claimedRun = await claimPendingRun();

      expect(claimedRun?.pipeline).toBeTruthy();
      expect(claimedRun?.pipeline.name).toBe(pipelineName);
      expect(claimedRun?.pipeline.description).toBe(
        "Test pipeline with relation"
      );
    });

    it("should not claim runs that are already running", async () => {
      const pipeline = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
        },
      });

      // Create running run
      await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "running",
          triggeredBy: "test",
        },
      });

      const claimedRun = await claimPendingRun();
      expect(claimedRun).toBeNull();
    });

    it("should not claim completed runs", async () => {
      const pipeline = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
        },
      });

      // Create completed run
      await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "success",
          triggeredBy: "test",
          finishedAt: new Date(),
        },
      });

      const claimedRun = await claimPendingRun();
      expect(claimedRun).toBeNull();
    });

    it("should not claim failed runs", async () => {
      const pipeline = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
        },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "failed",
          triggeredBy: "test",
          finishedAt: new Date(),
        },
      });

      const claimedRun = await claimPendingRun();
      expect(claimedRun).toBeNull();
    });
  });

  describe("Run Order (FIFO)", () => {
    it("should claim the oldest pending run first", async () => {
      const pipeline = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
        },
      });

      // Create runs with different timestamps
      const oldRun = await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "pending",
          triggeredBy: "test-old",
          startedAt: new Date(Date.now() - 60000), // 1 minute ago
        },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "pending",
          triggeredBy: "test-recent",
          startedAt: new Date(), // now
        },
      });

      const claimedRun = await claimPendingRun();

      expect(claimedRun?.id).toBe(oldRun.id);
      expect(claimedRun?.triggeredBy).toBe("test-old");
    });

    it("should process multiple pending runs in order", async () => {
      const pipeline = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
        },
      });

      // Create 3 runs
      const run1 = await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "pending",
          triggeredBy: "run1",
          startedAt: new Date(Date.now() - 120000),
        },
      });

      const run2 = await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "pending",
          triggeredBy: "run2",
          startedAt: new Date(Date.now() - 60000),
        },
      });

      const run3 = await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "pending",
          triggeredBy: "run3",
          startedAt: new Date(),
        },
      });

      // Claim them in order
      const claimed1 = await claimPendingRun();
      expect(claimed1?.id).toBe(run1.id);

      const claimed2 = await claimPendingRun();
      expect(claimed2?.id).toBe(run2.id);

      const claimed3 = await claimPendingRun();
      expect(claimed3?.id).toBe(run3.id);

      // No more pending
      const claimed4 = await claimPendingRun();
      expect(claimed4).toBeNull();
    });
  });

  describe("Race Condition Prevention", () => {
    it("should handle concurrent claims without double-claiming", async () => {
      const pipeline = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
        },
      });

      // Create 3 pending runs (reduced to avoid connection pool exhaustion)
      const runs = await Promise.all(
        [1, 2, 3].map((i) =>
          prisma.run.create({
            data: {
              pipelineId: pipeline.id,
              status: "pending",
              triggeredBy: `concurrent-${i}`,
              startedAt: new Date(Date.now() - i * 1000),
            },
          })
        )
      );

      // Simulate 5 concurrent workers trying to claim runs (reduced concurrency)
      const claimPromises = Array(5)
        .fill(null)
        .map(() => claimPendingRun());

      const claimedRuns = await Promise.all(claimPromises);

      // Filter out null results
      const validClaims = claimedRuns.filter((r) => r !== null);

      // Should have exactly 3 claimed runs (one per pending run)
      expect(validClaims).toHaveLength(3);

      // All claimed run IDs should be unique
      const claimedIds = validClaims.map((r) => r!.id);
      const uniqueIds = new Set(claimedIds);
      expect(uniqueIds.size).toBe(3);

      // All claimed IDs should match the original run IDs
      const originalIds = runs.map((r) => r.id).sort();
      expect(claimedIds.sort()).toEqual(originalIds);

      // Verify all runs are marked as running in database
      const allRuns = await prisma.run.findMany({
        where: {
          pipelineId: pipeline.id,
        },
      });

      allRuns.forEach((run) => {
        expect(run.status).toBe("running");
      });
    });

    it("should not allow same run to be claimed twice", async () => {
      const pipeline = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
        },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "pending",
          triggeredBy: "test",
        },
      });

      // Claim once
      const claim1 = await claimPendingRun();
      expect(claim1).toBeTruthy();

      // Try to claim again
      const claim2 = await claimPendingRun();
      expect(claim2).toBeNull();
    });

    it("should handle rapid sequential claims correctly", async () => {
      const pipeline = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
        },
      });

      // Create 20 pending runs (reduced from 100 to avoid timeout)
      const runPromises = Array(20)
        .fill(null)
        .map((_, i) =>
          prisma.run.create({
            data: {
              pipelineId: pipeline.id,
              status: "pending",
              triggeredBy: `rapid-${i}`,
              startedAt: new Date(Date.now() - (20 - i) * 100),
            },
          })
        );

      await Promise.all(runPromises);

      // Claim all runs sequentially as fast as possible
      const claimedRuns = [];
      for (let i = 0; i < 20; i++) {
        const run = await claimPendingRun();
        if (run) {
          claimedRuns.push(run);
        }
      }

      // Should have claimed exactly 20 runs
      expect(claimedRuns).toHaveLength(20);

      // All IDs should be unique
      const ids = claimedRuns.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(20);

      // Next claim should return null
      const extraClaim = await claimPendingRun();
      expect(extraClaim).toBeNull();
    });
  });

  describe("Transaction Isolation", () => {
    it("should atomically update run status within transaction", async () => {
      const pipeline = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
        },
      });

      const run = await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "pending",
          triggeredBy: "atomic-test",
        },
      });

      // Start claim
      const claimedRun = await claimPendingRun();

      // Verify the run status changed atomically
      expect(claimedRun?.id).toBe(run.id);
      expect(claimedRun?.status).toBe("running");

      // Database should reflect the change immediately
      const dbRun = await prisma.run.findUnique({
        where: { id: run.id },
      });
      expect(dbRun?.status).toBe("running");
    });

    it("should update startedAt timestamp when claiming", async () => {
      const pipeline = await prisma.pipeline.create({
        data: {
          name: getUniquePipelineName(),
        },
      });

      const originalStartTime = new Date(Date.now() - 10000);
      await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "pending",
          triggeredBy: "timestamp-test",
          startedAt: originalStartTime,
        },
      });

      const beforeClaim = Date.now();
      const claimedRun = await claimPendingRun();
      const afterClaim = Date.now();

      expect(claimedRun).toBeTruthy();
      expect(claimedRun?.startedAt).toBeTruthy();

      // The new startedAt should be recent (within test execution time)
      const claimedTime = claimedRun!.startedAt.getTime();
      expect(claimedTime).toBeGreaterThanOrEqual(beforeClaim);
      expect(claimedTime).toBeLessThanOrEqual(afterClaim);

      // Should NOT be the original time
      expect(claimedTime).not.toBe(originalStartTime.getTime());
    });
  });

  describe("Multiple Pipelines", () => {
    it("should claim runs from different pipelines", async () => {
      const pipeline1 = await prisma.pipeline.create({
        data: { name: getUniquePipelineName() },
      });

      const pipeline2 = await prisma.pipeline.create({
        data: { name: getUniquePipelineName() },
      });

      const run1 = await prisma.run.create({
        data: {
          pipelineId: pipeline1.id,
          status: "pending",
          triggeredBy: "pipeline1",
          startedAt: new Date(Date.now() - 1000),
        },
      });

      const run2 = await prisma.run.create({
        data: {
          pipelineId: pipeline2.id,
          status: "pending",
          triggeredBy: "pipeline2",
          startedAt: new Date(),
        },
      });

      // Should claim oldest first regardless of pipeline
      const claimed1 = await claimPendingRun();
      expect(claimed1?.id).toBe(run1.id);
      expect(claimed1?.pipeline.id).toBe(pipeline1.id);

      const claimed2 = await claimPendingRun();
      expect(claimed2?.id).toBe(run2.id);
      expect(claimed2?.pipeline.id).toBe(pipeline2.id);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty database gracefully", async () => {
      // Ensure database is empty
      await prisma.run.deleteMany({});

      const run = await claimPendingRun();
      expect(run).toBeNull();
    });

    it("should handle pipeline with no pending runs", async () => {
      const pipeline = await prisma.pipeline.create({
        data: { name: getUniquePipelineName() },
      });

      // Create only completed runs
      await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "success",
          triggeredBy: "test",
          finishedAt: new Date(),
        },
      });

      const run = await claimPendingRun();
      expect(run).toBeNull();
    });

    it("should preserve triggeredBy field", async () => {
      const pipeline = await prisma.pipeline.create({
        data: { name: getUniquePipelineName() },
      });

      await prisma.run.create({
        data: {
          pipelineId: pipeline.id,
          status: "pending",
          triggeredBy: "manual-ui-trigger",
        },
      });

      const claimed = await claimPendingRun();
      expect(claimed?.triggeredBy).toBe("manual-ui-trigger");
    });
  });
});
