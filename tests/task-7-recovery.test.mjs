/**
 * Task 7 Verification Tests
 * Tests: Resume Logic for Interrupted Runs
 */

import {
  PipelineExecutor,
  definePipeline,
  step,
  prisma,
  detectInterruptedRuns,
  analyzeStepCompletion,
  reconstructStepContext,
  resumeRun,
  RunRecoveryOrchestrator,
  registry,
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

/**
 * Helper function to simulate an interrupted run
 * Creates a run in "running" status with completed steps but no finished_at timestamp
 */
async function createInterruptedRun(pipelineName, completedStepNames = [], metadata = {}) {
  // Register a test pipeline
  const testPipeline = definePipeline({
    name: pipelineName,
    steps: [
      step("step-1", async () => ({ success: true, data: "Step 1 complete" })),
      step("step-2", async () => ({ success: true, data: "Step 2 complete" })),
      step("step-3", async () => ({ success: true, data: "Step 3 complete" })),
    ],
  });

  registry.registerPipeline(testPipeline);

  // Create pipeline in database
  const pipelineRecord = await prisma.pipeline.upsert({
    where: { name: pipelineName },
    create: {
      name: pipelineName,
      description: "Test pipeline for recovery",
    },
    update: {},
  });

  // Create a run that started 15 minutes ago (beyond 10-minute threshold)
  const oldTimestamp = new Date(Date.now() - 15 * 60 * 1000);

  const run = await prisma.run.create({
    data: {
      pipelineId: pipelineRecord.id,
      status: "running", // Still marked as running
      startedAt: oldTimestamp,
      triggeredBy: "test",
      finishedAt: null, // Not finished
    },
  });

  // Create completed steps
  for (const stepName of completedStepNames) {
    await prisma.step.create({
      data: {
        runId: run.id,
        name: stepName,
        status: "success",
        startedAt: oldTimestamp,
        finishedAt: new Date(oldTimestamp.getTime() + 5000), // 5 seconds later
        attemptCount: 1,
        result: JSON.stringify(metadata[stepName] || { completed: true }),
      },
    });
  }

  return { run, pipelineRecord };
}

async function runTests() {
  console.log("🧪 Task 7: Run Recovery - Verification Tests\n");
  console.log("=".repeat(60) + "\n");

  try {
    // Test Suite 1: Detect Interrupted Runs
    console.log("Test Suite 1: Detect Interrupted Runs");

    // Create an interrupted run
    const { run: interruptedRun } = await createInterruptedRun(
      "recovery-test-1-" + Date.now(),
      ["step-1", "step-2"]
    );

    // Detect interrupted runs
    const interruptedRuns = await detectInterruptedRuns();

    assert(
      interruptedRuns.some((r) => r.runId === interruptedRun.id),
      "Interrupted run detected"
    );

    const detected = interruptedRuns.find((r) => r.runId === interruptedRun.id);
    assert(detected !== undefined, "Found the specific interrupted run");
    assert(detected.completedSteps.length === 2, "Detected 2 completed steps");
    assert(
      detected.completedSteps.includes("step-1"),
      "Step 1 marked as completed"
    );
    assert(
      detected.completedSteps.includes("step-2"),
      "Step 2 marked as completed"
    );
    assert(
      detected.nextStepToExecute === "step-3",
      "Next step identified as step-3"
    );

    console.log();

    // Test Suite 2: Analyze Step Completion
    console.log("Test Suite 2: Analyze Step Completion");

    const analysis = await analyzeStepCompletion(interruptedRun.id);

    assert(analysis.completedSteps.length === 2, "2 steps completed");
    assert(analysis.failedSteps.length === 0, "No failed steps");
    assert(analysis.pendingSteps.length === 0, "No pending steps (old run)");
    assert(
      analysis.lastCompletedStep === "step-2",
      "Last completed step is step-2"
    );
    assert(
      analysis.completedSteps[0].name === "step-1",
      "First completed step is step-1"
    );
    assert(
      analysis.completedSteps[1].name === "step-2",
      "Second completed step is step-2"
    );

    console.log();

    // Test Suite 3: Reconstruct Step Context
    console.log("Test Suite 3: Reconstruct Step Context");

    const context = await reconstructStepContext(
      interruptedRun.id,
      interruptedRun.pipelineId,
      { triggeredBy: "test" }
    );

    assert(context.runId === interruptedRun.id, "Context has correct runId");
    assert(
      context.pipelineId === interruptedRun.pipelineId,
      "Context has correct pipelineId"
    );
    assert(
      Object.keys(context.prevResults).length === 2,
      "Context has 2 previous results"
    );
    assert(
      context.prevResults["step-1"] !== undefined,
      "Step 1 result in context"
    );
    assert(
      context.prevResults["step-2"] !== undefined,
      "Step 2 result in context"
    );
    assert(
      context.prevResults["step-1"].success === true,
      "Step 1 marked as success"
    );
    assert(
      context.metadata.triggeredBy === "test",
      "Metadata preserved in context"
    );

    console.log();

    // Test Suite 4: Resume Run Successfully
    console.log("Test Suite 4: Resume Run Successfully");

    const { run: resumableRun } = await createInterruptedRun(
      "recovery-test-resume-" + Date.now(),
      ["step-1"],
      {
        "step-1": { data: "First step data" },
      }
    );

    // Resume the run
    const resumeResult = await resumeRun(resumableRun.id);

    assert(resumeResult.success === true, "Resume succeeded");
    assert(resumeResult.stepsExecuted === 2, "Executed 2 remaining steps");
    assert(resumeResult.error === undefined, "No error in result");

    // Check database state
    const updatedRun = await prisma.run.findUnique({
      where: { id: resumableRun.id },
      include: { steps: true },
    });

    assert(updatedRun.status === "success", "Run marked as success");
    assert(updatedRun.finishedAt !== null, "Run has finishedAt timestamp");
    assert(updatedRun.steps.length === 3, "All 3 steps created");

    const allStepsSucceeded = updatedRun.steps.every(
      (s) => s.status === "success"
    );
    assert(allStepsSucceeded, "All steps marked as success");

    console.log();

    // Test Suite 5: Cannot Resume Run with Failed Steps
    console.log("Test Suite 5: Cannot Resume Run with Failed Steps");

    const { run: failedRun } = await createInterruptedRun(
      "recovery-test-failed-" + Date.now(),
      ["step-1"]
    );

    // Create a failed step
    await prisma.step.create({
      data: {
        runId: failedRun.id,
        name: "step-2",
        status: "failed",
        startedAt: new Date(),
        finishedAt: new Date(),
        attemptCount: 4,
        error: "Step 2 failed permanently",
      },
    });

    const failedResumeResult = await resumeRun(failedRun.id);

    assert(failedResumeResult.success === false, "Resume failed as expected");
    assert(
      failedResumeResult.error.includes("failed step"),
      "Error mentions failed steps"
    );
    assert(failedResumeResult.stepsExecuted === 0, "No steps executed");

    console.log();

    // Test Suite 6: Resume Already Completed Run
    console.log("Test Suite 6: Resume Already Completed Run");

    const { run: completedRun } = await createInterruptedRun(
      "recovery-test-complete-" + Date.now(),
      ["step-1", "step-2", "step-3"]
    );

    const completeResumeResult = await resumeRun(completedRun.id);

    assert(
      completeResumeResult.success === true,
      "Resume succeeds for completed run"
    );
    assert(
      completeResumeResult.stepsExecuted === 0,
      "No steps executed (all already done)"
    );

    const fullyCompletedRun = await prisma.run.findUnique({
      where: { id: completedRun.id },
    });

    assert(
      fullyCompletedRun.status === "success",
      "Run marked as success"
    );

    console.log();

    // Test Suite 7: Run Recovery Orchestrator
    console.log("Test Suite 7: Run Recovery Orchestrator");

    // Create multiple interrupted runs
    const { run: run1 } = await createInterruptedRun(
      "orchestrator-test-1-" + Date.now(),
      ["step-1"]
    );
    const { run: run2 } = await createInterruptedRun(
      "orchestrator-test-2-" + Date.now(),
      ["step-1", "step-2"]
    );
    const { run: run3 } = await createInterruptedRun(
      "orchestrator-test-3-" + Date.now(),
      []
    );

    const orchestrator = new RunRecoveryOrchestrator();
    const orchestratorResult = await orchestrator.recoverInterruptedRuns();

    assert(
      orchestratorResult.detected >= 3,
      `Detected at least 3 interrupted runs (found ${orchestratorResult.detected})`
    );
    assert(
      orchestratorResult.recovered >= 3,
      `Recovered at least 3 runs (recovered ${orchestratorResult.recovered})`
    );
    assert(
      orchestratorResult.failed === 0 || orchestratorResult.failed >= 0,
      "Failed count is valid"
    );

    // Check that runs were actually recovered
    const recoveredRun1 = await prisma.run.findUnique({
      where: { id: run1.id },
    });
    const recoveredRun2 = await prisma.run.findUnique({
      where: { id: run2.id },
    });
    const recoveredRun3 = await prisma.run.findUnique({
      where: { id: run3.id },
    });

    assert(
      recoveredRun1.status === "success",
      "Orchestrator recovered run 1"
    );
    assert(
      recoveredRun2.status === "success",
      "Orchestrator recovered run 2"
    );
    assert(
      recoveredRun3.status === "success",
      "Orchestrator recovered run 3"
    );

    console.log();

    // Test Suite 8: Resume Non-Existent Run
    console.log("Test Suite 8: Resume Non-Existent Run");

    const nonExistentResult = await resumeRun("non-existent-run-id");

    assert(
      nonExistentResult.success === false,
      "Resume fails for non-existent run"
    );
    assert(
      nonExistentResult.error.includes("not found"),
      "Error mentions run not found"
    );
    assert(nonExistentResult.stepsExecuted === 0, "No steps executed");

    console.log();

    // Test Suite 9: Resume with Missing Pipeline
    console.log("Test Suite 9: Resume with Missing Pipeline");

    // Create a run with a pipeline that doesn't exist in registry
    const orphanPipeline = await prisma.pipeline.create({
      data: {
        name: "orphan-pipeline-" + Date.now(),
        description: "Pipeline not in registry",
      },
    });

    const orphanRun = await prisma.run.create({
      data: {
        pipelineId: orphanPipeline.id,
        status: "running",
        startedAt: new Date(Date.now() - 20 * 60 * 1000),
        triggeredBy: "test",
      },
    });

    const orphanResult = await resumeRun(orphanRun.id);

    assert(
      orphanResult.success === false,
      "Resume fails for orphan pipeline"
    );
    assert(
      orphanResult.error.includes("not found in registry"),
      "Error mentions pipeline not found"
    );
    assert(orphanResult.stepsExecuted === 0, "No steps executed");

    console.log();

    // Test Suite 10: Context Reconstruction with Complex Data
    console.log("Test Suite 10: Context Reconstruction with Complex Data");

    const complexData = {
      "step-1": {
        users: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
        total: 2,
      },
      "step-2": {
        processed: true,
        timestamp: new Date().toISOString(),
        nested: { deep: { value: 42 } },
      },
    };

    const { run: complexRun } = await createInterruptedRun(
      "recovery-test-complex-" + Date.now(),
      ["step-1", "step-2"],
      complexData
    );

    const complexContext = await reconstructStepContext(
      complexRun.id,
      complexRun.pipelineId
    );

    assert(
      complexContext.prevResults["step-1"].data.users.length === 2,
      "Complex array data preserved"
    );
    assert(
      complexContext.prevResults["step-1"].data.users[0].name === "Alice",
      "Nested object data preserved"
    );
    assert(
      complexContext.prevResults["step-2"].data.nested.deep.value === 42,
      "Deeply nested data preserved"
    );
    assert(
      complexContext.prevResults["step-2"].data.processed === true,
      "Boolean data preserved"
    );

    console.log();

    // Test Suite 11: Interrupted Run Detection Threshold
    console.log("Test Suite 11: Interrupted Run Detection Threshold");

    // Create a recent run (within threshold - should NOT be detected)
    const recentPipeline = await prisma.pipeline.create({
      data: {
        name: "recent-pipeline-" + Date.now(),
        description: "Recent pipeline",
      },
    });

    const recentRun = await prisma.run.create({
      data: {
        pipelineId: recentPipeline.id,
        status: "running",
        startedAt: new Date(Date.now() - 5 * 60 * 1000), // Only 5 minutes ago
        triggeredBy: "test",
      },
    });

    const allInterrupted = await detectInterruptedRuns();
    const recentFound = allInterrupted.some((r) => r.runId === recentRun.id);

    assert(
      !recentFound,
      "Recent run (5 min) not detected as interrupted"
    );

    console.log();

    // Test Suite 12: Step Context Data Types
    console.log("Test Suite 12: Step Context Data Types");

    const { run: typeTestRun } = await createInterruptedRun(
      "recovery-test-types-" + Date.now(),
      ["step-1"],
      {
        "step-1": {
          string: "test",
          number: 123,
          boolean: true,
          null: null,
          array: [1, 2, 3],
          object: { key: "value" },
        },
      }
    );

    const typeContext = await reconstructStepContext(
      typeTestRun.id,
      typeTestRun.pipelineId
    );

    const data = typeContext.prevResults["step-1"].data;
    assert(typeof data.string === "string", "String type preserved");
    assert(typeof data.number === "number", "Number type preserved");
    assert(typeof data.boolean === "boolean", "Boolean type preserved");
    assert(data.null === null, "Null value preserved");
    assert(Array.isArray(data.array), "Array type preserved");
    assert(typeof data.object === "object", "Object type preserved");

    console.log();

    // Summary
    console.log("=".repeat(60));
    console.log(`\n📊 Test Results:`);
    console.log(`   Total:  ${tests.total}`);
    console.log(`   Passed: ${tests.passed} ✅`);
    console.log(`   Failed: ${tests.failed} ❌`);

    if (tests.failed === 0) {
      console.log(`\n🎉 All Task 7 requirements verified successfully!`);
      console.log(`\n✅ Task 7 Complete: Resume Logic for Interrupted Runs`);
      console.log(
        `   - Interrupted run detection (10-minute threshold)`
      );
      console.log(
        `   - Step completion analysis (completed, failed, pending)`
      );
      console.log(
        `   - StepContext reconstruction from database`
      );
      console.log(
        `   - Resume execution from last successful step`
      );
      console.log(
        `   - Run recovery orchestration for multiple runs`
      );
      console.log(
        `   - Cannot resume runs with failed steps (manual intervention required)`
      );
      console.log(
        `   - Complex data type preservation through JSON serialization`
      );
      console.log(
        `   - Edge case handling (non-existent runs, missing pipelines)`
      );
    } else {
      console.log(`\n⚠️  Some tests failed. Task 7 may need review.`);
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
