/**
 * Pipeline Type Definitions
 * Core TypeScript interfaces for the pipeline execution system
 */
/**
 * Context provided to each step during pipeline execution
 * Contains all information needed for a step to execute
 */
export interface StepContext<TPrevResults = Record<string, unknown>> {
    /** Unique identifier for the current run */
    runId: string;
    /** Unique identifier for the pipeline being executed */
    pipelineId: string;
    /** Results from all previous steps in the pipeline */
    prevResults: TPrevResults;
    /** Additional metadata about the run (e.g., trigger source, user info) */
    metadata?: Record<string, unknown>;
}
/**
 * Result returned by a step handler function
 * Indicates success/failure and provides data or error information
 */
export interface StepResult<TData = unknown> {
    /** Whether the step executed successfully */
    success: boolean;
    /** Data returned by the step (available to subsequent steps) */
    data?: TData;
    /** Error message if step failed */
    error?: string;
}
/**
 * Function signature for a step handler
 * Receives context and returns a result (sync or async)
 */
export type StepHandler<TContext = StepContext, TResult = unknown> = (context: TContext) => Promise<StepResult<TResult>> | StepResult<TResult>;
/**
 * Definition of a single step in a pipeline
 */
export interface StepDefinition {
    /** Unique name for the step within the pipeline */
    name: string;
    /** Handler function that executes the step logic */
    handler: StepHandler;
    /** Optional configuration for the step */
    config?: {
        /** Maximum number of retry attempts (default: 0) */
        maxRetries?: number;
        /** Timeout in milliseconds (default: no timeout) */
        timeout?: number;
    };
}
/**
 * Complete pipeline definition with metadata and steps
 */
export interface PipelineDefinition {
    /** Unique name for the pipeline */
    name: string;
    /** Human-readable description of the pipeline's purpose */
    description?: string;
    /** Ordered array of step definitions to execute */
    steps: StepDefinition[];
    /** Optional cron schedule for automatic execution */
    schedule?: string;
}
/**
 * Options for defining a new pipeline
 */
export interface DefinePipelineOptions {
    /** Unique name for the pipeline */
    name: string;
    /** Human-readable description of the pipeline's purpose */
    description?: string;
    /** Optional cron schedule for automatic execution */
    schedule?: string;
    /** Array of step definitions */
    steps: StepDefinition[];
}
/**
 * Options for creating a step definition
 */
export interface StepOptions {
    /** Maximum number of retry attempts (default: 0) */
    maxRetries?: number;
    /** Timeout in milliseconds (default: no timeout) */
    timeout?: number;
}
//# sourceMappingURL=types.d.ts.map