#!/usr/bin/env node
/**
 * Test script to trigger a pipeline run and verify worker functionality
 */

import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const prisma = new PrismaClient();

const TEST_PIPELINE_NAME = "example-pipeline";

async function main() {
  console.log("🧪 Testing worker functionality...\n");

  try {
    // 1. Check if pipeline exists
    console.log("1️⃣  Checking if pipeline exists...");
    const pipeline = await prisma.pipeline.findFirst({
      where: { name: TEST_PIPELINE_NAME },
    });

    if (!pipeline) {
      console.error(`❌ Pipeline '${TEST_PIPELINE_NAME}' not found in database`);
      process.exit(1);
    }
    console.log(`✅ Found pipeline: ${pipeline.name} (ID: ${pipeline.id})\n`);

    // 2. Create a new pending run
    console.log("2️⃣  Creating a new pending run...");
    const run = await prisma.run.create({
      data: {
        pipelineId: pipeline.id,
        status: "pending",
        triggeredBy: "test-script",
        startedAt: new Date(),
      },
    });
    console.log(`✅ Created run ID: ${run.id}\n`);

    // 3. Wait for worker to pick up the run (poll for 30 seconds)
    console.log("3️⃣  Waiting for worker to pick up the run...");
    const maxWaitTime = 30000; // 30 seconds
    const pollInterval = 1000; // 1 second
    let elapsed = 0;
    let updatedRun = null;

    while (elapsed < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      elapsed += pollInterval;

      updatedRun = await prisma.run.findUnique({
        where: { id: run.id },
        include: { steps: true },
      });

      if (updatedRun && updatedRun.status !== "pending") {
        console.log(`✅ Worker picked up run! Status: ${updatedRun.status}`);
        break;
      }

      process.stdout.write(`⏳ Waiting... (${elapsed / 1000}s)\r`);
    }

    if (!updatedRun || updatedRun.status === "pending") {
      console.error("\n❌ Worker did not pick up the run within 30 seconds");
      process.exit(1);
    }

    console.log();

    // 4. Display run results
    console.log("4️⃣  Run Results:");
    console.log(`   Status: ${updatedRun.status}`);
    console.log(`   Started: ${updatedRun.startedAt?.toISOString()}`);
    console.log(`   Completed: ${updatedRun.completedAt?.toISOString()}`);
    console.log(`   Duration: ${updatedRun.duration || 0}ms`);
    console.log(`   Steps executed: ${updatedRun.steps.length}\n`);

    // 5. Display step results
    console.log("5️⃣  Step Details:");
    for (const step of updatedRun.steps) {
      const statusIcon = step.status === "completed" ? "✅" : "❌";
      console.log(`   ${statusIcon} ${step.name}: ${step.status}`);
      if (step.result) {
        console.log(
          `      Result: ${JSON.stringify(step.result).substring(0, 100)}`
        );
      }
    }

    console.log("\n✨ Worker functionality test completed successfully!");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
