/**
 * Task 4 Verification Tests
 * Tests: Basic Pipeline Executor with state persistence
 */

import {
  PipelineExecutor,
  definePipeline,
  step,
  prisma,
  getRun,
  getStepsByRun,
} from "../dist/core/index.js";

const tests = {
  passed: 0,
  failed: 0,
  total: 0,
};

function assert(condition, message) {
  tests.total++;
  if (condition) {
    console.log(`  ✅ ${message}`);
    tests.passed++;
  } else {
    console.log(`  ❌ ${message}`);
    tests.failed++;
    throw new Error(`Test failed: ${message}`);
  }
}

async function runTests() {
  console.log("🧪 Task 4: Pipeline Executor - Verification Tests\n");
  console.log("=".repeat(60) + "\n");

  try {
    // Test Suite 1: Executor Initialization
    console.log("Test Suite 1: Executor Initialization");

    const simplePipeline = definePipeline({
      name: "test-executor-init",
      description: "Test initialization",
      steps: [
        step("step-1", async (ctx) => ({ success: true, data: 1 })),
      ],
    });

    const executor = new PipelineExecutor(simplePipeline);
    assert(executor !== null, "Executor created successfully");
    assert(
      executor.getPipeline().name === "test-executor-init",
      "Executor has correct pipeline"
    );

    // Test invalid pipeline
    try {
      new PipelineExecutor(null);
      assert(false, "Should reject null pipeline");
    } catch (error) {
      assert(error.message.includes("required"), "Rejects null pipeline");
    }

    try {
      new PipelineExecutor({ name: "test", steps: [] });
      assert(false, "Should reject pipeline with no steps");
    } catch (error) {
      assert(error.message.includes("at least one"), "Rejects empty steps");
    }

    console.log();

    // Test Suite 2: Simple Pipeline Execution
    console.log("Test Suite 2: Simple Pipeline Execution");

    const successPipeline = definePipeline({
      name: "success-pipeline-" + Date.now(),
      steps: [
        step("greet", async (ctx) => {
          return { success: true, data: "Hello" };
        }),
      ],
    });

    const successExecutor = new PipelineExecutor(successPipeline);
    const result1 = await successExecutor.execute({ triggeredBy: "test" });

    assert(result1.success === true, "Simple pipeline execution succeeded");
    assert(result1.runId !== "", "Run ID was created");
    assert(result1.stepResults["greet"] !== undefined, "Step result captured");
    assert(
      result1.stepResults["greet"].success === true,
      "Step marked as successful"
    );
    assert(result1.stepResults["greet"].data === "Hello", "Step data correct");
    assert(result1.duration > 0, "Execution duration tracked");

    // Verify database state
    const run1 = await getRun(result1.runId);
    assert(run1 !== null, "Run record exists in database");
    assert(run1.status === "success", "Run status is success");
    assert(run1.finishedAt !== null, "Run has finish time");

    const steps1 = await getStepsByRun(result1.runId);
    assert(steps1.length === 1, "One step recorded");
    assert(steps1[0].name === "greet", "Step name correct");
    assert(steps1[0].status === "success", "Step status is success");
    assert(steps1[0].startedAt !== null, "Step has start time");
    assert(steps1[0].finishedAt !== null, "Step has finish time");

    console.log();

    // Test Suite 3: Multi-Step Pipeline with Context Passing
    console.log("Test Suite 3: Multi-Step Pipeline with Context Passing");

    const multiStepPipeline = definePipeline({
      name: "multi-step-" + Date.now(),
      steps: [
        step("fetch-data", async (ctx) => {
          return { success: true, data: { users: ["Alice", "Bob"] } };
        }),
        step("process-data", async (ctx) => {
          const prevData = ctx.prevResults["fetch-data"];
          const users = prevData.data.users;
          return { success: true, data: `Processed ${users.length} users` };
        }),
        step("save-result", async (ctx) => {
          const processResult = ctx.prevResults["process-data"];
          return { success: true, data: `Saved: ${processResult.data}` };
        }),
      ],
    });

    const multiExecutor = new PipelineExecutor(multiStepPipeline);
    const result2 = await multiExecutor.execute();

    assert(result2.success === true, "Multi-step pipeline succeeded");
    assert(Object.keys(result2.stepResults).length === 3, "All 3 steps executed");
    assert(
      result2.stepResults["fetch-data"].data.users.length === 2,
      "First step data correct"
    );
    assert(
      result2.stepResults["process-data"].data === "Processed 2 users",
      "Second step processed prev results"
    );
    assert(
      result2.stepResults["save-result"].data ===
        "Saved: Processed 2 users",
      "Third step used prev results"
    );

    // Verify database
    const steps2 = await getStepsByRun(result2.runId);
    assert(steps2.length === 3, "All 3 steps in database");
    assert(steps2[0].name === "fetch-data", "Steps in correct order (1)");
    assert(steps2[1].name === "process-data", "Steps in correct order (2)");
    assert(steps2[2].name === "save-result", "Steps in correct order (3)");
    assert(
      steps2.every((s) => s.status === "success"),
      "All steps succeeded"
    );

    console.log();

    // Test Suite 4: Error Handling - Step Failure
    console.log("Test Suite 4: Error Handling - Step Failure");

    const failingPipeline = definePipeline({
      name: "failing-pipeline-" + Date.now(),
      steps: [
        step("step-1", async (ctx) => {
          return { success: true, data: "OK" };
        }),
        step("failing-step", async (ctx) => {
          return { success: false, error: "Something went wrong" };
        }),
        step("step-3", async (ctx) => {
          return { success: true, data: "Should not run" };
        }),
      ],
    });

    const failExecutor = new PipelineExecutor(failingPipeline);
    const result3 = await failExecutor.execute();

    assert(result3.success === false, "Pipeline execution failed");
    assert(result3.error !== undefined, "Error message present");
    assert(
      result3.error.includes("Something went wrong") ||
        result3.error.includes("failing-step"),
      "Error message mentions failure"
    );

    // Verify database - run should be failed
    const run3 = await getRun(result3.runId);
    assert(run3.status === "failed", "Run status is failed");

    const steps3 = await getStepsByRun(result3.runId);
    assert(steps3.length === 2, "Only 2 steps created (pipeline stopped)");
    assert(steps3[0].status === "success", "First step succeeded");
    assert(steps3[1].status === "failed", "Second step failed");
    assert(steps3[1].error !== null, "Failed step has error");

    console.log();

    // Test Suite 5: Error Handling - Exception Thrown
    console.log("Test Suite 5: Error Handling - Exception Thrown");

    const throwingPipeline = definePipeline({
      name: "throwing-pipeline-" + Date.now(),
      steps: [
        step("step-1", async (ctx) => {
          return { success: true };
        }),
        step("throwing-step", async (ctx) => {
          throw new Error("Unexpected error");
        }),
        step("step-3", async (ctx) => {
          return { success: true };
        }),
      ],
    });

    const throwExecutor = new PipelineExecutor(throwingPipeline);
    const result4 = await throwExecutor.execute();

    assert(result4.success === false, "Pipeline failed on exception");
    assert(result4.error.includes("Unexpected error"), "Exception message captured");

    const run4 = await getRun(result4.runId);
    assert(run4.status === "failed", "Run marked as failed");

    const steps4 = await getStepsByRun(result4.runId);
    assert(steps4.length === 2, "Execution stopped after exception");
    assert(steps4[0].status === "success", "Step before exception succeeded");
    assert(steps4[1].status === "failed", "Throwing step marked as failed");
    assert(
      steps4[1].error.includes("Unexpected error"),
      "Error stored in database"
    );

    console.log();

    // Test Suite 6: Metadata and Context
    console.log("Test Suite 6: Metadata and Context");

    const metadataPipeline = definePipeline({
      name: "metadata-pipeline-" + Date.now(),
      steps: [
        step("check-metadata", async (ctx) => {
          return {
            success: true,
            data: {
              hasRunId: ctx.runId !== undefined,
              hasPipelineId: ctx.pipelineId !== undefined,
              hasPrevResults: ctx.prevResults !== undefined,
              hasMetadata: ctx.metadata !== undefined,
              metadataValue: ctx.metadata?.userId,
            },
          };
        }),
      ],
    });

    const metaExecutor = new PipelineExecutor(metadataPipeline);
    const result5 = await metaExecutor.execute({
      triggeredBy: "api",
      metadata: { userId: "user123", action: "test" },
    });

    const stepData = result5.stepResults["check-metadata"].data;
    assert(stepData.hasRunId === true, "Context has runId");
    assert(stepData.hasPipelineId === true, "Context has pipelineId");
    assert(stepData.hasPrevResults === true, "Context has prevResults");
    assert(stepData.hasMetadata === true, "Context has metadata");
    assert(
      stepData.metadataValue === "user123",
      "Metadata passed correctly"
    );

    console.log();

    // Test Suite 7: Pipeline Reusability
    console.log("Test Suite 7: Pipeline Reusability");

    const reusablePipeline = definePipeline({
      name: "reusable-" + Date.now(),
      steps: [
        step("increment", async (ctx) => {
          const count = (ctx.metadata?.count || 0) + 1;
          return { success: true, data: count };
        }),
      ],
    });

    const reuseExecutor = new PipelineExecutor(reusablePipeline);

    const run1Result = await reuseExecutor.execute({ metadata: { count: 0 } });
    const run2Result = await reuseExecutor.execute({ metadata: { count: 5 } });
    const run3Result = await reuseExecutor.execute({ metadata: { count: 10 } });

    assert(run1Result.success === true, "First execution succeeded");
    assert(run2Result.success === true, "Second execution succeeded");
    assert(run3Result.success === true, "Third execution succeeded");
    assert(
      run1Result.stepResults["increment"].data === 1,
      "First run: count = 1"
    );
    assert(
      run2Result.stepResults["increment"].data === 6,
      "Second run: count = 6"
    );
    assert(
      run3Result.stepResults["increment"].data === 11,
      "Third run: count = 11"
    );
    assert(
      run1Result.runId !== run2Result.runId,
      "Different runs have different IDs"
    );
    assert(
      run2Result.runId !== run3Result.runId,
      "Each execution creates new run"
    );

    console.log();

    // Summary
    console.log("=".repeat(60));
    console.log(`\n📊 Test Results:`);
    console.log(`   Total:  ${tests.total}`);
    console.log(`   Passed: ${tests.passed} ✅`);
    console.log(`   Failed: ${tests.failed} ❌`);

    if (tests.failed === 0) {
      console.log(`\n🎉 All Task 4 requirements verified successfully!`);
      console.log(`\n✅ Task 4 Complete: Pipeline Executor`);
      console.log(`   - PipelineExecutor class created with validation`);
      console.log(`   - Sequential step execution working`);
      console.log(`   - Database state persistence functional`);
      console.log(`   - StepContext properly passed between steps`);
      console.log(`   - Error handling with status transitions working`);
      console.log(`   - Pipeline runs tracked in PostgreSQL`);
    } else {
      console.log(`\n⚠️  Some tests failed. Task 4 may need review.`);
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Test suite failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    tests.failed++;
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log(`\n✅ Database disconnected`);
  }
}

runTests();
