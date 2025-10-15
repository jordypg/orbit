/**
 * Pipeline Executor
 * Executes pipeline steps sequentially with state persistence and error handling
 */
import type { PipelineDefinition, StepResult } from "./types.js";
/**
 * Calculates exponential backoff delay in seconds
 * Formula: min(30 * 2^attempt, 300)
 * @param attempt - Current attempt number (1-based)
 * @returns Delay in seconds
 */
export declare function calculateBackoff(attempt: number): number;
/**
 * Options for pipeline execution
 */
export interface ExecutionOptions {
    /** User or system identifier that triggered the execution */
    triggeredBy?: string;
    /** Additional metadata to pass to all steps */
    metadata?: Record<string, unknown>;
}
/**
 * Result of a complete pipeline execution
 */
export interface PipelineExecutionResult {
    /** ID of the run that was created */
    runId: string;
    /** Whether the entire pipeline succeeded */
    success: boolean;
    /** Results from each step */
    stepResults: Record<string, StepResult>;
    /** Error message if pipeline failed */
    error?: string;
    /** Duration of execution in milliseconds */
    duration: number;
}
/**
 * Pipeline Executor - Runs pipeline steps sequentially with database persistence
 */
export declare class PipelineExecutor {
    private pipeline;
    /**
     * Creates a new pipeline executor
     * @param pipeline - Pipeline definition to execute
     * @throws Error if pipeline is invalid
     */
    constructor(pipeline: PipelineDefinition);
    /**
     * Validates a pipeline before execution
     * @throws Error if pipeline is invalid
     */
    private validatePipeline;
    /**
     * Executes the pipeline
     * @param options - Execution options
     * @returns Execution result with runId and success status
     */
    execute(options?: ExecutionOptions): Promise<PipelineExecutionResult>;
    /**
     * Ensures the pipeline exists in the database
     * Creates it if it doesn't exist
     */
    private ensurePipelineInDatabase;
    /**
     * Executes all steps in the pipeline sequentially
     * @throws Error if any step fails
     */
    private executeSteps;
    /**
     * Executes a single step with retry logic
     * @throws Error if step execution fails after all retries
     */
    private executeStep;
    /**
     * Gets the pipeline definition
     */
    getPipeline(): PipelineDefinition;
}
//# sourceMappingURL=executor.d.ts.map