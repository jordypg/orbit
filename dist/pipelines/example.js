/**
 * Example Pipeline
 * A simple pipeline to demonstrate the CLI
 */
import { definePipeline, step } from "../core/index.js";
export default definePipeline({
    name: "example-pipeline",
    description: "A simple example pipeline with 3 steps",
    steps: [
        step("greet", async () => {
            console.log("  👋 Hello from step 1!");
            return {
                success: true,
                data: { message: "Hello, World!" },
            };
        }),
        step("process", async (ctx) => {
            const greeting = ctx.prevResults["greet"].data.message;
            console.log(`  🔄 Processing: ${greeting}`);
            // Simulate some work
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return {
                success: true,
                data: { processed: greeting.toUpperCase() },
            };
        }),
        step("finish", async (ctx) => {
            const result = ctx.prevResults["process"].data.processed;
            console.log(`  ✅ Final result: ${result}`);
            return {
                success: true,
                data: { final: result },
            };
        }),
    ],
});
//# sourceMappingURL=example.js.map