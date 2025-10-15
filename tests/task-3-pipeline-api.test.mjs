/**
 * Task 3 Verification Tests
 * Tests: Pipeline Definition API (definePipeline, step, registry)
 */

import {
  definePipeline,
  step,
  registry,
  PipelineRegistry,
  PipelineRegistryError,
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
  console.log("🧪 Task 3: Pipeline Definition API - Verification Tests\n");
  console.log("=".repeat(60) + "\n");

  try {
    // Test Suite 1: Step Function Creation
    console.log("Test Suite 1: step() Function");

    const simpleStep = step("simple-step", async (ctx) => {
      return { success: true, data: "test" };
    });
    assert(simpleStep.name === "simple-step", "Step has correct name");
    assert(typeof simpleStep.handler === "function", "Step has handler function");
    assert(simpleStep.config === undefined, "Step without options has no config");

    const stepWithOptions = step(
      "retry-step",
      async (ctx) => {
        return { success: true };
      },
      { maxRetries: 3, timeout: 5000 }
    );
    assert(stepWithOptions.config.maxRetries === 3, "Step has correct maxRetries");
    assert(stepWithOptions.config.timeout === 5000, "Step has correct timeout");

    // Test step name validation
    try {
      step("", async () => ({ success: true }));
      assert(false, "Should reject empty step name");
    } catch (error) {
      assert(error.message.includes("empty"), "Rejects empty step name");
    }

    try {
      step("invalid@name!", async () => ({ success: true }));
      assert(false, "Should reject invalid step name");
    } catch (error) {
      assert(
        error.message.includes("alphanumeric"),
        "Rejects invalid characters in step name"
      );
    }

    try {
      step("valid-name", "not a function");
      assert(false, "Should reject non-function handler");
    } catch (error) {
      assert(error.message.includes("function"), "Rejects non-function handler");
    }

    console.log();

    // Test Suite 2: definePipeline Function
    console.log("Test Suite 2: definePipeline() Function");

    const step1 = step("step-1", async (ctx) => ({ success: true, data: 1 }));
    const step2 = step("step-2", async (ctx) => ({ success: true, data: 2 }));

    const pipeline = definePipeline({
      name: "test-pipeline",
      description: "Test pipeline",
      schedule: "0 * * * *",
      steps: [step1, step2],
    });

    assert(pipeline.name === "test-pipeline", "Pipeline has correct name");
    assert(
      pipeline.description === "Test pipeline",
      "Pipeline has correct description"
    );
    assert(pipeline.schedule === "0 * * * *", "Pipeline has correct schedule");
    assert(pipeline.steps.length === 2, "Pipeline has correct number of steps");
    assert(pipeline.steps[0].name === "step-1", "First step has correct name");
    assert(pipeline.steps[1].name === "step-2", "Second step has correct name");

    // Test pipeline without schedule
    const pipelineNoSchedule = definePipeline({
      name: "no-schedule",
      steps: [step1],
    });
    assert(
      pipelineNoSchedule.schedule === undefined,
      "Pipeline without schedule works"
    );

    // Test pipeline name validation
    try {
      definePipeline({
        name: "",
        steps: [step1],
      });
      assert(false, "Should reject empty pipeline name");
    } catch (error) {
      assert(error.message.includes("empty"), "Rejects empty pipeline name");
    }

    try {
      definePipeline({
        name: "invalid@pipeline!",
        steps: [step1],
      });
      assert(false, "Should reject invalid pipeline name");
    } catch (error) {
      assert(
        error.message.includes("alphanumeric"),
        "Rejects invalid characters in pipeline name"
      );
    }

    // Test steps validation
    try {
      definePipeline({
        name: "no-steps",
        steps: [],
      });
      assert(false, "Should reject pipeline with no steps");
    } catch (error) {
      assert(error.message.includes("at least one"), "Rejects empty steps array");
    }

    try {
      definePipeline({
        name: "duplicate-steps",
        steps: [step1, step1],
      });
      assert(false, "Should reject duplicate step names");
    } catch (error) {
      assert(error.message.includes("Duplicate"), "Rejects duplicate step names");
    }

    // Test schedule validation
    try {
      definePipeline({
        name: "invalid-schedule",
        schedule: "not a cron",
        steps: [step1],
      });
      assert(false, "Should reject invalid schedule");
    } catch (error) {
      assert(error.message.includes("cron"), "Rejects invalid cron schedule");
    }

    console.log();

    // Test Suite 3: Pipeline Registry - Basic Operations
    console.log("Test Suite 3: Pipeline Registry - Basic Operations");

    // Clear registry before tests
    registry.clearRegistry();
    assert(registry.count() === 0, "Registry starts empty after clear");

    // Register a pipeline
    const testPipeline = definePipeline({
      name: "registry-test-1",
      description: "Registry test",
      steps: [step1],
    });

    registry.registerPipeline(testPipeline);
    assert(registry.count() === 1, "Registry has 1 pipeline after registration");
    assert(registry.hasPipeline("registry-test-1"), "Registry has the pipeline");

    // Retrieve pipeline
    const retrieved = registry.getPipeline("registry-test-1");
    assert(retrieved.name === "registry-test-1", "Retrieved pipeline has correct name");
    assert(retrieved.description === "Registry test", "Retrieved pipeline has correct description");

    // List pipelines
    const allPipelines = registry.listPipelines();
    assert(allPipelines.length === 1, "List returns 1 pipeline");
    assert(allPipelines[0].name === "registry-test-1", "List contains correct pipeline");

    // Get pipeline names
    const names = registry.getPipelineNames();
    assert(names.length === 1, "getPipelineNames returns 1 name");
    assert(names[0] === "registry-test-1", "getPipelineNames returns correct name");

    console.log();

    // Test Suite 4: Pipeline Registry - Validation
    console.log("Test Suite 4: Pipeline Registry - Validation");

    // Test duplicate registration
    try {
      registry.registerPipeline(testPipeline);
      assert(false, "Should reject duplicate pipeline registration");
    } catch (error) {
      assert(
        error instanceof PipelineRegistryError,
        "Throws PipelineRegistryError for duplicates"
      );
      assert(error.message.includes("already registered"), "Error message mentions duplicate");
    }

    // Test retrieving non-existent pipeline
    try {
      registry.getPipeline("does-not-exist");
      assert(false, "Should throw error for non-existent pipeline");
    } catch (error) {
      assert(
        error instanceof PipelineRegistryError,
        "Throws PipelineRegistryError for missing pipeline"
      );
      assert(error.message.includes("not found"), "Error message mentions not found");
    }

    // Test hasPipeline with non-existent
    assert(!registry.hasPipeline("does-not-exist"), "hasPipeline returns false for non-existent");

    // Test registering invalid pipeline (no steps)
    try {
      registry.registerPipeline({
        name: "no-steps",
        steps: [],
      });
      assert(false, "Should reject pipeline with no steps");
    } catch (error) {
      assert(
        error instanceof PipelineRegistryError,
        "Throws PipelineRegistryError for invalid pipeline"
      );
      assert(error.message.includes("at least one step"), "Error mentions missing steps");
    }

    console.log();

    // Test Suite 5: Pipeline Registry - Multiple Pipelines
    console.log("Test Suite 5: Pipeline Registry - Multiple Pipelines");

    const pipeline2 = definePipeline({
      name: "registry-test-2",
      steps: [step2],
    });

    const pipeline3 = definePipeline({
      name: "registry-test-3",
      steps: [step1, step2],
    });

    registry.registerPipeline(pipeline2);
    registry.registerPipeline(pipeline3);

    assert(registry.count() === 3, "Registry has 3 pipelines");

    const allNames = registry.getPipelineNames();
    assert(allNames.length === 3, "getPipelineNames returns 3 names");
    assert(allNames.includes("registry-test-1"), "Contains first pipeline");
    assert(allNames.includes("registry-test-2"), "Contains second pipeline");
    assert(allNames.includes("registry-test-3"), "Contains third pipeline");

    // Unregister a pipeline
    const removed = registry.unregisterPipeline("registry-test-2");
    assert(removed === true, "unregisterPipeline returns true for existing pipeline");
    assert(registry.count() === 2, "Registry has 2 pipelines after unregister");
    assert(!registry.hasPipeline("registry-test-2"), "Unregistered pipeline is gone");

    const removedAgain = registry.unregisterPipeline("registry-test-2");
    assert(removedAgain === false, "unregisterPipeline returns false for non-existent");

    console.log();

    // Test Suite 6: Pipeline Registry - Singleton Pattern
    console.log("Test Suite 6: Pipeline Registry - Singleton Pattern");

    const instance1 = PipelineRegistry.getInstance();
    const instance2 = PipelineRegistry.getInstance();

    assert(instance1 === instance2, "getInstance returns same instance");
    assert(instance1 === registry, "registry export is the singleton instance");

    // Verify state is shared
    assert(instance1.count() === instance2.count(), "Both instances have same count");
    assert(instance1.hasPipeline("registry-test-1"), "Instance 1 has pipeline");
    assert(instance2.hasPipeline("registry-test-1"), "Instance 2 has same pipeline");

    console.log();

    // Test Suite 7: End-to-End Pipeline Definition
    console.log("Test Suite 7: End-to-End Pipeline Definition");

    registry.clearRegistry();

    // Create a realistic pipeline
    const fetchStep = step(
      "fetch-users",
      async (ctx) => {
        return { success: true, data: ["user1", "user2"] };
      },
      { maxRetries: 2, timeout: 5000 }
    );

    const processStep = step("process-data", async (ctx) => {
      const users = ctx.prevResults["fetch-users"];
      return { success: true, data: `Processed ${users.length} users` };
    });

    const emailPipeline = definePipeline({
      name: "send-emails",
      description: "Fetch users and send emails",
      schedule: "0 9 * * *",
      steps: [fetchStep, processStep],
    });

    registry.registerPipeline(emailPipeline);

    const savedPipeline = registry.getPipeline("send-emails");
    assert(savedPipeline.name === "send-emails", "E2E: Pipeline name correct");
    assert(savedPipeline.steps.length === 2, "E2E: Pipeline has 2 steps");
    assert(savedPipeline.steps[0].name === "fetch-users", "E2E: First step correct");
    assert(savedPipeline.steps[0].config.maxRetries === 2, "E2E: Step config preserved");
    assert(savedPipeline.steps[1].name === "process-data", "E2E: Second step correct");

    console.log();

    // Summary
    console.log("=".repeat(60));
    console.log(`\n📊 Test Results:`);
    console.log(`   Total:  ${tests.total}`);
    console.log(`   Passed: ${tests.passed} ✅`);
    console.log(`   Failed: ${tests.failed} ❌`);

    if (tests.failed === 0) {
      console.log(`\n🎉 All Task 3 requirements verified successfully!`);
      console.log(`\n✅ Task 3 Complete: Pipeline Definition API`);
      console.log(`   - TypeScript interfaces defined (StepContext, StepResult, etc.)`);
      console.log(`   - step() function creates validated step definitions`);
      console.log(`   - definePipeline() creates validated pipeline definitions`);
      console.log(`   - Pipeline registry singleton working correctly`);
      console.log(`   - Comprehensive validation for names and configurations`);
      console.log(`   - Duplicate prevention and error handling functional`);
    } else {
      console.log(`\n⚠️  Some tests failed. Task 3 may need review.`);
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Test suite failed:", error.message);
    tests.failed++;
    process.exit(1);
  }
}

runTests();
