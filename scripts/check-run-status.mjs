#!/usr/bin/env node
/**
 * Check the status of a run in the database
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const runId = process.argv[2];

  if (!runId) {
    console.error("Usage: node check-run-status.mjs <runId>");
    process.exit(1);
  }

  try {
    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: {
        pipeline: true,
        steps: {
          orderBy: { startedAt: "asc" },
        },
      },
    });

    if (!run) {
      console.error(`Run ${runId} not found`);
      process.exit(1);
    }

    console.log("\n📊 Run Status Report\n");
    console.log(`Run ID: ${run.id}`);
    console.log(`Pipeline: ${run.pipeline.name}`);
    console.log(`Status: ${run.status}`);
    console.log(`Triggered By: ${run.triggeredBy || "N/A"}`);
    console.log(`Started: ${run.startedAt.toISOString()}`);
    console.log(`Finished: ${run.finishedAt?.toISOString() || "N/A"}`);

    if (run.finishedAt) {
      const duration = run.finishedAt.getTime() - run.startedAt.getTime();
      console.log(`Duration: ${duration}ms`);
    }

    console.log(`\nSteps (${run.steps.length}):`);
    for (const step of run.steps) {
      const statusIcon =
        step.status === "completed"
          ? "✅"
          : step.status === "failed"
          ? "❌"
          : "🔄";
      console.log(`  ${statusIcon} ${step.name} - ${step.status}`);
      if (step.result) {
        const resultStr = JSON.stringify(step.result, null, 2);
        console.log(`     Result: ${resultStr.substring(0, 200)}`);
      }
      if (step.error) {
        console.log(`     Error: ${step.error}`);
      }
    }
    console.log();
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
