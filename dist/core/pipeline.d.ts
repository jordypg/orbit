/**
 * Pipeline Definition API
 * Functions for creating and defining pipelines with type safety
 */
import type { DefinePipelineOptions, PipelineDefinition, StepDefinition, StepHandler, StepOptions } from "./types.js";
/**
 * Creates a step definition with proper typing and validation
 *
 * @param name - Unique name for the step
 * @param handler - Async function that executes the step logic
 * @param options - Optional configuration for retries and timeout
 * @returns A validated StepDefinition object
 *
 * @example
 * ```typescript
 * const fetchUsers = step("fetch-users", async (ctx) => {
 *   const users = await db.getUsers();
 *   return { success: true, data: users };
 * });
 * ```
 */
export declare function step<TResult = unknown>(name: string, handler: StepHandler<any, TResult>, options?: StepOptions): StepDefinition;
/**
 * Defines a new pipeline with metadata and step definitions
 *
 * @param options - Pipeline configuration including name, description, and steps
 * @returns A validated PipelineDefinition object
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * const emailPipeline = definePipeline({
 *   name: "send-marketing-emails",
 *   description: "Sends marketing emails to users",
 *   schedule: "0 9 * * *",
 *   steps: [
 *     step("fetch-users", async (ctx) => {
 *       const users = await db.getUsers();
 *       return { success: true, data: users };
 *     }),
 *     step("send-emails", async (ctx) => {
 *       const users = ctx.prevResults["fetch-users"];
 *       await sendEmails(users);
 *       return { success: true };
 *     })
 *   ]
 * });
 * ```
 */
export declare function definePipeline(options: DefinePipelineOptions): PipelineDefinition;
//# sourceMappingURL=pipeline.d.ts.map