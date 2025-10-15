/**
 * Task 5 Verification Tests
 * Tests: Basic CLI Interface with pipeline discovery and execution
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";

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
  console.log("🧪 Task 5: CLI Interface - Verification Tests\n");
  console.log("=".repeat(60) + "\n");

  try {
    // Test Suite 1: CLI Help and Version
    console.log("Test Suite 1: CLI Help and Version");

    const helpOutput = execSync("node dist/cli.js --help", {
      encoding: "utf-8",
    });
    assert(helpOutput.includes("orbit"), "CLI shows 'orbit' name");
    assert(helpOutput.includes("run <name>"), "Help shows 'run' command");
    assert(helpOutput.includes("list"), "Help shows 'list' command");
    assert(
      helpOutput.includes("pipeline"),
      "Help mentions pipeline"
    );

    const versionOutput = execSync("node dist/cli.js --version", {
      encoding: "utf-8",
    });
    assert(versionOutput.includes("1.0.0"), "CLI shows version 1.0.0");

    console.log();

    // Test Suite 2: Pipeline Discovery and Loading
    console.log("Test Suite 2: Pipeline Discovery and Loading");

    const listOutput = execSync("node dist/cli.js list", {
      encoding: "utf-8",
    });

    assert(
      listOutput.includes("example-pipeline"),
      "List shows example-pipeline"
    );
    assert(
      listOutput.includes("simple example pipeline"),
      "List shows pipeline description"
    );
    assert(listOutput.includes("3 steps"), "List shows step count");
    assert(
      listOutput.includes("Loaded") && listOutput.includes("pipeline"),
      "Shows loaded pipeline count"
    );

    console.log();

    // Test Suite 3: Pipeline Execution
    console.log("Test Suite 3: Pipeline Execution");

    const runOutput = execSync("node dist/cli.js run example-pipeline", {
      encoding: "utf-8",
    });

    assert(
      runOutput.includes("Running Pipeline: example-pipeline"),
      "Shows pipeline name in header"
    );
    assert(
      runOutput.includes("Description:"),
      "Shows pipeline description"
    );
    assert(runOutput.includes("Steps: 3"), "Shows step count");
    assert(
      runOutput.includes("Starting execution"),
      "Shows execution start message"
    );
    assert(
      runOutput.includes("Hello from step 1"),
      "Executes step 1 (greet)"
    );
    assert(
      runOutput.includes("Processing"),
      "Executes step 2 (process)"
    );
    assert(
      runOutput.includes("Final result"),
      "Executes step 3 (finish)"
    );
    assert(
      runOutput.includes("completed successfully"),
      "Shows success message"
    );
    assert(runOutput.includes("Run ID:"), "Shows run ID");
    assert(
      runOutput.includes("Step Results:"),
      "Shows step results section"
    );
    assert(
      runOutput.includes("greet") && runOutput.includes("success"),
      "Shows greet step success"
    );
    assert(
      runOutput.includes("process") && runOutput.includes("success"),
      "Shows process step success"
    );
    assert(
      runOutput.includes("finish") && runOutput.includes("success"),
      "Shows finish step success"
    );

    console.log();

    // Test Suite 4: Error Handling - Pipeline Not Found
    console.log("Test Suite 4: Error Handling - Pipeline Not Found");

    try {
      execSync("node dist/cli.js run nonexistent-pipeline", {
        encoding: "utf-8",
        stdio: "pipe",
      });
      assert(false, "Should fail for nonexistent pipeline");
    } catch (error) {
      const output = error.stderr || error.stdout;
      assert(
        output.includes("not found") ||
          output.includes("nonexistent-pipeline"),
        "Shows pipeline not found error"
      );
      assert(
        output.includes("Available pipelines"),
        "Shows available pipelines when not found"
      );
    }

    console.log();

    // Test Suite 5: Environment Variable Validation
    console.log("Test Suite 5: Environment Variable Validation");

    try {
      // Run without DATABASE_URL
      execSync("node dist/cli.js list", {
        encoding: "utf-8",
        env: { ...process.env, DATABASE_URL: "" },
        stdio: "pipe",
      });
      assert(false, "Should fail without DATABASE_URL");
    } catch (error) {
      const output = error.stderr || error.stdout;
      assert(
        output.includes("DATABASE_URL") &&
          (output.includes("not set") || output.includes("required")),
        "Shows DATABASE_URL error"
      );
    }

    console.log();

    // Test Suite 6: Failed Pipeline Execution
    console.log("Test Suite 6: Failed Pipeline Execution");

    // Create a failing test pipeline
    const testPipelinesDir = "dist/pipelines";
    const failingPipelinePath = join(testPipelinesDir, "test-failing.js");

    const failingPipelineCode = `
import { definePipeline, step } from "../core/index.js";

export default definePipeline({
  name: "test-failing-pipeline",
  description: "A pipeline that fails",
  steps: [
    step("success-step", async () => {
      return { success: true, data: "OK" };
    }),
    step("failing-step", async () => {
      return { success: false, error: "Intentional failure" };
    }),
    step("should-not-run", async () => {
      return { success: true };
    })
  ]
});
`;

    writeFileSync(failingPipelinePath, failingPipelineCode);

    try {
      execSync("node dist/cli.js run test-failing-pipeline", {
        encoding: "utf-8",
        stdio: "pipe",
      });
      assert(false, "Should fail when pipeline step fails");
    } catch (error) {
      const output = error.stderr || error.stdout;
      assert(
        output.includes("failed") || output.includes("Error"),
        "Shows pipeline failure"
      );
      assert(
        output.includes("Intentional failure") ||
          output.includes("failing-step"),
        "Shows error from failing step"
      );
      assert(output.includes("Run ID:"), "Shows run ID even on failure");
    } finally {
      // Cleanup
      rmSync(failingPipelinePath, { force: true });
    }

    console.log();

    // Test Suite 7: Colored Output (basic check)
    console.log("Test Suite 7: Colored Output");

    // Note: ANSI color codes won't show in piped output, but we can verify structure
    const coloredOutput = execSync("node dist/cli.js list", {
      encoding: "utf-8",
    });

    assert(
      coloredOutput.includes("✓") || coloredOutput.includes("→"),
      "Uses Unicode symbols for visual feedback"
    );
    assert(
      coloredOutput.includes("Loaded") && coloredOutput.includes("pipeline"),
      "Shows informative messages"
    );

    console.log();

    // Test Suite 8: Pipeline File Format Validation
    console.log("Test Suite 8: Pipeline File Format Validation");

    // Create invalid pipeline
    const invalidPipelinePath = join(testPipelinesDir, "test-invalid.js");
    const invalidPipelineCode = `
export default {
  name: "test-invalid"
  // Missing steps array
};
`;

    writeFileSync(invalidPipelinePath, invalidPipelineCode);

    const invalidOutput = execSync("node dist/cli.js list", {
      encoding: "utf-8",
    });

    assert(
      invalidOutput.includes("does not export a valid pipeline") ||
        !invalidOutput.includes("test-invalid"),
      "Rejects invalid pipeline format"
    );

    // Cleanup
    rmSync(invalidPipelinePath, { force: true });

    console.log();

    // Test Suite 9: Executable Configuration
    console.log("Test Suite 9: Executable Configuration");

    // Check shebang exists
    const cliContent = execSync("head -1 dist/cli.js", {
      encoding: "utf-8",
    });
    assert(
      cliContent.includes("#!/usr/bin/env node"),
      "CLI file has shebang"
    );

    // Check package.json bin entry
    const packageJson = JSON.parse(
      execSync("cat package.json", { encoding: "utf-8" })
    );
    assert(
      packageJson.bin && packageJson.bin.orbit,
      "package.json has bin.orbit entry"
    );
    assert(
      packageJson.bin.orbit.includes("cli.js"),
      "bin.orbit points to cli.js"
    );

    console.log();

    // Summary
    console.log("=".repeat(60));
    console.log(`\n📊 Test Results:`);
    console.log(`   Total:  ${tests.total}`);
    console.log(`   Passed: ${tests.passed} ✅`);
    console.log(`   Failed: ${tests.failed} ❌`);

    if (tests.failed === 0) {
      console.log(`\n🎉 All Task 5 requirements verified successfully!`);
      console.log(`\n✅ Task 5 Complete: CLI Interface`);
      console.log(`   - Commander.js CLI structure working`);
      console.log(`   - Pipeline discovery and loading functional`);
      console.log(`   - Colored console logging implemented`);
      console.log(`   - Environment variable handling working`);
      console.log(`   - Executable configuration complete`);
      console.log(`   - Help and version commands functional`);
      console.log(`   - Error handling for missing pipelines`);
      console.log(`   - Failed pipeline execution handled correctly`);
    } else {
      console.log(`\n⚠️  Some tests failed. Task 5 may need review.`);
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Test suite failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    tests.failed++;
    process.exit(1);
  }
}

runTests();
