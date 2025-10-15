/**
 * Pipeline Registry
 * Singleton registry for storing and retrieving pipeline definitions
 */
import type { PipelineDefinition } from "./types.js";
/**
 * Error thrown when a pipeline operation fails
 */
export declare class PipelineRegistryError extends Error {
    constructor(message: string);
}
/**
 * Singleton registry for managing pipeline definitions
 * Provides thread-safe operations for registering and retrieving pipelines
 */
declare class PipelineRegistry {
    private static instance;
    private pipelines;
    private constructor();
    /**
     * Gets the singleton instance of the registry
     */
    static getInstance(): PipelineRegistry;
    /**
     * Registers a new pipeline definition
     * @param pipeline - Pipeline definition to register
     * @throws PipelineRegistryError if a pipeline with the same name already exists
     *
     * @example
     * ```typescript
     * const registry = PipelineRegistry.getInstance();
     * registry.registerPipeline(myPipeline);
     * ```
     */
    registerPipeline(pipeline: PipelineDefinition): void;
    /**
     * Retrieves a pipeline by name
     * @param name - Name of the pipeline to retrieve
     * @returns The pipeline definition
     * @throws PipelineRegistryError if pipeline not found
     *
     * @example
     * ```typescript
     * const registry = PipelineRegistry.getInstance();
     * const pipeline = registry.getPipeline("my-pipeline");
     * ```
     */
    getPipeline(name: string): PipelineDefinition;
    /**
     * Checks if a pipeline exists in the registry
     * @param name - Name of the pipeline to check
     * @returns True if pipeline exists, false otherwise
     *
     * @example
     * ```typescript
     * const registry = PipelineRegistry.getInstance();
     * if (registry.hasPipeline("my-pipeline")) {
     *   // Pipeline exists
     * }
     * ```
     */
    hasPipeline(name: string): boolean;
    /**
     * Lists all registered pipelines
     * @returns Array of all pipeline definitions
     *
     * @example
     * ```typescript
     * const registry = PipelineRegistry.getInstance();
     * const allPipelines = registry.listPipelines();
     * console.log(`Total pipelines: ${allPipelines.length}`);
     * ```
     */
    listPipelines(): PipelineDefinition[];
    /**
     * Gets the names of all registered pipelines
     * @returns Array of pipeline names
     *
     * @example
     * ```typescript
     * const registry = PipelineRegistry.getInstance();
     * const names = registry.getPipelineNames();
     * console.log("Registered pipelines:", names);
     * ```
     */
    getPipelineNames(): string[];
    /**
     * Removes a pipeline from the registry
     * @param name - Name of the pipeline to remove
     * @returns True if pipeline was removed, false if it didn't exist
     *
     * @example
     * ```typescript
     * const registry = PipelineRegistry.getInstance();
     * registry.unregisterPipeline("my-pipeline");
     * ```
     */
    unregisterPipeline(name: string): boolean;
    /**
     * Clears all pipelines from the registry
     * Primarily used for testing purposes
     *
     * @example
     * ```typescript
     * const registry = PipelineRegistry.getInstance();
     * registry.clearRegistry(); // Remove all pipelines
     * ```
     */
    clearRegistry(): void;
    /**
     * Gets the count of registered pipelines
     * @returns Number of registered pipelines
     */
    count(): number;
}
export declare const registry: PipelineRegistry;
export { PipelineRegistry };
//# sourceMappingURL=registry.d.ts.map