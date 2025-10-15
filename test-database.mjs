import {
  createPipeline,
  getPipeline,
  listPipelines,
  updatePipeline,
  deletePipeline,
  createRun,
  getRun,
  createRunWithSteps,
  prisma
} from "./dist/core/index.js";

async function testDatabase() {
  console.log("🧪 Testing Database Operations\n");
  console.log("=".repeat(50) + "\n");

  try {
    console.log("1️⃣  Creating a pipeline...");
    const pipeline = await createPipeline({
      name: "email-campaign-" + Date.now(),
      description: "Send marketing emails",
      schedule: "0 9 * * *"
    });
    console.log("✅ Created:", pipeline.name);
    console.log();

    console.log("2️⃣  Listing all pipelines...");
    const all = await listPipelines();
    console.log("✅ Total pipelines:", all.length);
    console.log();

    console.log("3️⃣  Creating run with 3 steps (transaction)...");
    const { run, steps } = await createRunWithSteps(
      pipeline.id,
      ["fetch-users", "send-emails", "update-stats"],
      "manual"
    );
    console.log("✅ Run created with", steps.length, "steps");
    console.log();

    console.log("4️⃣  Fetching run details...");
    const runDetails = await getRun(run.id);
    console.log("✅ Run has", runDetails.steps.length, "steps");
    console.log();

    console.log("5️⃣  Updating pipeline...");
    await updatePipeline(pipeline.id, {
      description: "Updated description"
    });
    console.log("✅ Pipeline updated");
    console.log();

    console.log("6️⃣  Cleaning up...");
    await deletePipeline(pipeline.id);
    console.log("✅ Test data deleted");
    console.log();

    console.log("=".repeat(50));
    console.log("🎉 All database operations work!");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
