import { definePipeline, step } from "../core/index.js";

  export default definePipeline({
    name: "jpg-test-pipeline",
    description: "My first Orbit pipeline",

    steps: [
      // Step 1: Fetch some data
      step("fetch-data", async (_ctx) => {
        console.log("📥 Fetching data...");

        // Your code here - call an API, query database, etc.
        const data = { users: 100, active: 75 };

        return {
          success: true,
          data: data  // This will be available to the next step
        };
      }),

      // Step 2: Process the data
      step("process-data", async (ctx) => {
        // Access data from previous step
        const fetchResult = ctx.prevResults["fetch-data"].data;

        console.log(`🔄 Processing ${fetchResult.users} users...`);

        const processedCount = fetchResult.active;

        return {
          success: true,
          data: { processed: processedCount }
        };
      }),

      // Step 3: Save the result
      step("save-result", async (ctx) => {
        const processedData = ctx.prevResults["process-data"].data;

        console.log(`💾 Saving ${processedData.processed} records...`);

        // Save to database, send to API, etc.

        return {
          success: true,
          data: { saved: processedData.processed }
        };
      })
    ]
  });