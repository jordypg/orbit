/**
 * Integration tests for parallel step execution
 * Tests dependency-based DAG execution, parallel step execution, and error handling
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  PipelineExecutor,
  definePipeline,
  step,
  type StepContext,
  type StepResult,
} from "../src/core/index.js";
import prisma from "../src/core/prisma.js";

// Test pipeline name base
const TEST_PIPELINE_BASE = "parallel-test-pipeline";

// Generate unique pipeline name for each test
let testCounter = 0;
function getUniquePipelineName(): string {
  return `${TEST_PIPELINE_BASE}-${Date.now()}-${testCounter++}`;
}

// Track step execution for verification
interface ExecutionEvent {
  stepName: string;
  timestamp: number;
  type: 'start' | 'end';
}

let executionEvents: ExecutionEvent[] = [];

/**
 * Helper to record step execution timing
 */
function recordExecution(stepName: string, type: 'start' | 'end'): void {
  executionEvents.push({
    stepName,
    timestamp: Date.now(),
    type,
  });
}

/**
 * Helper to check if two steps overlapped in time
 */
function stepsOverlapped(step1: string, step2: string): boolean {
  const step1Start = executionEvents.find(e => e.stepName === step1 && e.type === 'start')?.timestamp;
  const step1End = executionEvents.find(e => e.stepName === step1 && e.type === 'end')?.timestamp;
  const step2Start = executionEvents.find(e => e.stepName === step2 && e.type === 'start')?.timestamp;
  const step2End = executionEvents.find(e => e.stepName === step2 && e.type === 'end')?.timestamp;

  if (!step1Start || !step1End || !step2Start || !step2End) {
    return false;
  }

  // Steps overlap if one starts before the other ends
  return step1Start < step2End && step2Start < step1End;
}

describe("Parallel Step Execution", () => {
  beforeEach(async () => {
    // Clear execution events
    executionEvents = [];

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

  describe("Basic Parallel Execution", () => {
    it("should execute independent steps in parallel", async () => {
      const pipeline = definePipeline({
        name: getUniquePipelineName(),
        description: "Test parallel execution",
        steps: [
          step("step1", async (): Promise<StepResult> => {
            recordExecution("step1", "start");
            await new Promise(resolve => setTimeout(resolve, 100));
            recordExecution("step1", "end");
            return { success: true, data: { value: 1 } };
          }),
          step("step2", async (): Promise<StepResult> => {
            recordExecution("step2", "start");
            await new Promise(resolve => setTimeout(resolve, 100));
            recordExecution("step2", "end");
            return { success: true, data: { value: 2 } };
          }, {
            dependsOn: ['step1'],
          }),
          step("step3", async (): Promise<StepResult> => {
            recordExecution("step3", "start");
            await new Promise(resolve => setTimeout(resolve, 100));
            recordExecution("step3", "end");
            return { success: true, data: { value: 3 } };
          }, {
            dependsOn: ['step1'],
          }),
        ],
      });

      const executor = new PipelineExecutor(pipeline);
      const result = await executor.execute();

      expect(result.success).toBe(true);

      // step2 and step3 should have overlapped (both depend only on step1)
      expect(stepsOverlapped("step2", "step3")).toBe(true);
    });

    it("should respect sequential execution when no dependencies specified", async () => {
      const pipeline = definePipeline({
        name: getUniquePipelineName(),
        description: "Test sequential execution (backward compatibility)",
        steps: [
          step("step1", async (): Promise<StepResult> => {
            recordExecution("step1", "start");
            await new Promise(resolve => setTimeout(resolve, 50));
            recordExecution("step1", "end");
            return { success: true };
          }),
          step("step2", async (): Promise<StepResult> => {
            recordExecution("step2", "start");
            await new Promise(resolve => setTimeout(resolve, 50));
            recordExecution("step2", "end");
            return { success: true };
          }),
          step("step3", async (): Promise<StepResult> => {
            recordExecution("step3", "start");
            await new Promise(resolve => setTimeout(resolve, 50));
            recordExecution("step3", "end");
            return { success: true };
          }),
        ],
      });

      const executor = new PipelineExecutor(pipeline);
      const result = await executor.execute();

      expect(result.success).toBe(true);

      // Steps should NOT overlap (sequential execution)
      expect(stepsOverlapped("step1", "step2")).toBe(false);
      expect(stepsOverlapped("step2", "step3")).toBe(false);
    });
  });

  describe("Diamond Dependency Pattern", () => {
    it("should handle diamond dependency correctly", async () => {
      const pipeline = definePipeline({
        name: getUniquePipelineName(),
        description: "Diamond dependency: D depends on B and C, which both depend on A",
        steps: [
          step("stepA", async (): Promise<StepResult> => {
            recordExecution("stepA", "start");
            await new Promise(resolve => setTimeout(resolve, 100));
            recordExecution("stepA", "end");
            return { success: true, data: { value: "A" } };
          }),
          step("stepB", async (ctx: StepContext): Promise<StepResult> => {
            recordExecution("stepB", "start");
            expect(ctx.prevResults["stepA"]).toBeTruthy();
            await new Promise(resolve => setTimeout(resolve, 100));
            recordExecution("stepB", "end");
            return { success: true, data: { value: "B" } };
          }, {
            dependsOn: ['stepA'],
          }),
          step("stepC", async (ctx: StepContext): Promise<StepResult> => {
            recordExecution("stepC", "start");
            expect(ctx.prevResults["stepA"]).toBeTruthy();
            await new Promise(resolve => setTimeout(resolve, 100));
            recordExecution("stepC", "end");
            return { success: true, data: { value: "C" } };
          }, {
            dependsOn: ['stepA'],
          }),
          step("stepD", async (ctx: StepContext): Promise<StepResult> => {
            recordExecution("stepD", "start");
            expect(ctx.prevResults["stepB"]).toBeTruthy();
            expect(ctx.prevResults["stepC"]).toBeTruthy();
            recordExecution("stepD", "end");
            return { success: true, data: { value: "D" } };
          }, {
            dependsOn: ['stepB', 'stepC'],
          }),
        ],
      });

      const executor = new PipelineExecutor(pipeline);
      const result = await executor.execute();

      expect(result.success).toBe(true);

      // stepB and stepC should have overlapped (both depend only on stepA)
      expect(stepsOverlapped("stepB", "stepC")).toBe(true);

      // stepD should not have started until both B and C finished
      const stepDStart = executionEvents.find(e => e.stepName === "stepD" && e.type === 'start')?.timestamp;
      const stepBEnd = executionEvents.find(e => e.stepName === "stepB" && e.type === 'end')?.timestamp;
      const stepCEnd = executionEvents.find(e => e.stepName === "stepC" && e.type === 'end')?.timestamp;

      expect(stepDStart).toBeGreaterThan(stepBEnd!);
      expect(stepDStart).toBeGreaterThan(stepCEnd!);
    });
  });

  describe("Context and Data Flow", () => {
    it("should provide correct prevResults to parallel steps", async () => {
      const pipeline = definePipeline({
        name: getUniquePipelineName(),
        description: "Test context propagation in parallel execution",
        steps: [
          step("prep", async (): Promise<StepResult> => {
            return { success: true, data: { shared: "data" } };
          }),
          step("parallel1", async (ctx: StepContext): Promise<StepResult> => {
            expect(ctx.prevResults["prep"]).toEqual({
              success: true,
              data: { shared: "data" },
            });
            return { success: true, data: { result: "parallel1" } };
          }, {
            dependsOn: ['prep'],
          }),
          step("parallel2", async (ctx: StepContext): Promise<StepResult> => {
            expect(ctx.prevResults["prep"]).toEqual({
              success: true,
              data: { shared: "data" },
            });
            return { success: true, data: { result: "parallel2" } };
          }, {
            dependsOn: ['prep'],
          }),
          step("merge", async (ctx: StepContext): Promise<StepResult> => {
            expect(ctx.prevResults["prep"]).toBeTruthy();
            expect(ctx.prevResults["parallel1"]).toBeTruthy();
            expect(ctx.prevResults["parallel2"]).toBeTruthy();
            return { success: true };
          }, {
            dependsOn: ['parallel1', 'parallel2'],
          }),
        ],
      });

      const executor = new PipelineExecutor(pipeline);
      const result = await executor.execute();

      expect(result.success).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should let parallel siblings finish when one fails", async () => {
      const pipeline = definePipeline({
        name: getUniquePipelineName(),
        description: "Test error handling in parallel execution",
        steps: [
          step("step1", async (): Promise<StepResult> => {
            return { success: true };
          }),
          step("failingStep", async (): Promise<StepResult> => {
            recordExecution("failingStep", "start");
            await new Promise(resolve => setTimeout(resolve, 50));
            recordExecution("failingStep", "end");
            return { success: false, error: "Intentional failure" };
          }, {
            dependsOn: ['step1'],
            maxRetries: 0,
          }),
          step("successStep", async (): Promise<StepResult> => {
            recordExecution("successStep", "start");
            await new Promise(resolve => setTimeout(resolve, 150));
            recordExecution("successStep", "end");
            return { success: true };
          }, {
            dependsOn: ['step1'],
          }),
        ],
      });

      const executor = new PipelineExecutor(pipeline);
      const result = await executor.execute();

      expect(result.success).toBe(false);

      // Both failingStep and successStep should have executed
      expect(executionEvents.find(e => e.stepName === "failingStep")).toBeTruthy();
      expect(executionEvents.find(e => e.stepName === "successStep")).toBeTruthy();

      // successStep should have completed despite failingStep failing
      const successStepEnd = executionEvents.find(e => e.stepName === "successStep" && e.type === 'end');
      expect(successStepEnd).toBeTruthy();
    });
  });

  describe("Validation and Error Cases", () => {
    it("should reject forward dependencies", () => {
      expect(() => {
        definePipeline({
          name: getUniquePipelineName(),
          description: "Invalid forward dependency",
          steps: [
            step("step1", async (): Promise<StepResult> => {
              return { success: true };
            }, {
              dependsOn: ['step2'], // Forward dependency - invalid!
            }),
            step("step2", async (): Promise<StepResult> => {
              return { success: true };
            }),
          ],
        });
      }).toThrow();
    });

    it("should reject non-existent dependencies", () => {
      expect(() => {
        definePipeline({
          name: getUniquePipelineName(),
          description: "Invalid non-existent dependency",
          steps: [
            step("step1", async (): Promise<StepResult> => {
              return { success: true };
            }, {
              dependsOn: ['nonexistent'], // Non-existent dependency
            }),
          ],
        });
      }).toThrow();
    });
  });

  describe("Database Consistency", () => {
    it("should create step records correctly for parallel execution", async () => {
      const pipelineName = getUniquePipelineName();
      const pipeline = definePipeline({
        name: pipelineName,
        description: "Test database consistency",
        steps: [
          step("step1", async (): Promise<StepResult> => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return { success: true };
          }),
          step("parallel1", async (): Promise<StepResult> => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return { success: true };
          }, {
            dependsOn: ['step1'],
          }),
          step("parallel2", async (): Promise<StepResult> => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return { success: true };
          }, {
            dependsOn: ['step1'],
          }),
        ],
      });

      const executor = new PipelineExecutor(pipeline);
      const result = await executor.execute();

      expect(result.success).toBe(true);

      // Verify database records
      const run = await prisma.run.findFirst({
        where: {
          pipeline: { name: pipelineName },
        },
        include: {
          steps: true,
        },
      });

      expect(run).toBeTruthy();
      expect(run?.steps).toHaveLength(3);

      // Verify all steps succeeded
      for (const step of run?.steps || []) {
        expect(step.status).toBe("success");
        expect(step.startedAt).toBeTruthy();
        expect(step.finishedAt).toBeTruthy();
      }

      // Verify parallel steps have overlapping execution times
      const parallel1 = run?.steps.find(s => s.name === "parallel1");
      const parallel2 = run?.steps.find(s => s.name === "parallel2");

      if (parallel1 && parallel2) {
        const p1Start = parallel1.startedAt?.getTime();
        const p1End = parallel1.finishedAt?.getTime();
        const p2Start = parallel2.startedAt?.getTime();
        const p2End = parallel2.finishedAt?.getTime();

        // Check for overlap
        const overlapped = p1Start! < p2End! && p2Start! < p1End!;
        expect(overlapped).toBe(true);
      }
    });
  });
});
