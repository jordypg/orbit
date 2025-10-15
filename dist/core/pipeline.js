/**
 * Pipeline Definition API
 * Functions for creating and defining pipelines with type safety
 */
/**
 * Validates a pipeline name
 * @throws Error if name is invalid
 */
function validatePipelineName(name) {
    if (typeof name !== "string") {
        throw new Error("Pipeline name must be a string");
    }
    if (name.trim().length === 0) {
        throw new Error("Pipeline name cannot be empty");
    }
    // Allow alphanumeric, hyphens, underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        throw new Error("Pipeline name can only contain alphanumeric characters, hyphens, and underscores");
    }
    if (name.length > 100) {
        throw new Error("Pipeline name cannot exceed 100 characters");
    }
}
/**
 * Validates a step name
 * @throws Error if name is invalid
 */
function validateStepName(name) {
    if (typeof name !== "string") {
        throw new Error("Step name must be a string");
    }
    if (name.trim().length === 0) {
        throw new Error("Step name cannot be empty");
    }
    // Allow alphanumeric, hyphens, underscores, spaces
    if (!/^[a-zA-Z0-9_\-\s]+$/.test(name)) {
        throw new Error("Step name can only contain alphanumeric characters, hyphens, underscores, and spaces");
    }
    if (name.length > 100) {
        throw new Error("Step name cannot exceed 100 characters");
    }
}
/**
 * Validates step definitions array
 * @throws Error if steps are invalid
 */
function validateSteps(steps) {
    if (!Array.isArray(steps)) {
        throw new Error("Steps must be an array");
    }
    if (steps.length === 0) {
        throw new Error("Pipeline must have at least one step");
    }
    // Check for duplicate step names
    const stepNames = new Set();
    for (const step of steps) {
        if (stepNames.has(step.name)) {
            throw new Error(`Duplicate step name: ${step.name}`);
        }
        stepNames.add(step.name);
        // Validate each step
        validateStepName(step.name);
        if (typeof step.handler !== "function") {
            throw new Error(`Step "${step.name}" handler must be a function`);
        }
    }
}
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
export function step(name, handler, options) {
    validateStepName(name);
    if (typeof handler !== "function") {
        throw new Error("Step handler must be a function");
    }
    return {
        name,
        handler,
        config: options
            ? {
                maxRetries: options.maxRetries,
                timeout: options.timeout,
            }
            : undefined,
    };
}
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
export function definePipeline(options) {
    // Validate pipeline name
    validatePipelineName(options.name);
    // Validate steps
    validateSteps(options.steps);
    // Validate schedule if provided (basic cron validation)
    if (options.schedule) {
        if (typeof options.schedule !== "string") {
            throw new Error("Schedule must be a string");
        }
        // Basic cron format check (5 or 6 fields)
        const cronParts = options.schedule.trim().split(/\s+/);
        if (cronParts.length < 5 || cronParts.length > 6) {
            throw new Error("Schedule must be a valid cron expression (5 or 6 fields)");
        }
    }
    // Create pipeline definition
    const pipeline = {
        name: options.name,
        description: options.description,
        steps: options.steps,
        schedule: options.schedule,
    };
    return pipeline;
}
//# sourceMappingURL=pipeline.js.map