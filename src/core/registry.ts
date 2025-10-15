/**
 * Pipeline Registry
 * Singleton registry for storing and retrieving pipeline definitions
 */

import type { PipelineDefinition } from "./types.js";

/**
 * Error thrown when a pipeline operation fails
 */
export class PipelineRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineRegistryError";
  }
}

/**
 * Singleton registry for managing pipeline definitions
 * Provides thread-safe operations for registering and retrieving pipelines
 */
class PipelineRegistry {
  private static instance: PipelineRegistry;
  private pipelines: Map<string, PipelineDefinition>;

  private constructor() {
    this.pipelines = new Map();
  }

  /**
   * Gets the singleton instance of the registry
   */
  public static getInstance(): PipelineRegistry {
    if (!PipelineRegistry.instance) {
      PipelineRegistry.instance = new PipelineRegistry();
    }
    return PipelineRegistry.instance;
  }

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
  public registerPipeline(pipeline: PipelineDefinition): void {
    if (!pipeline || !pipeline.name) {
      throw new PipelineRegistryError("Invalid pipeline definition");
    }

    if (this.pipelines.has(pipeline.name)) {
      throw new PipelineRegistryError(
        `Pipeline "${pipeline.name}" is already registered`
      );
    }

    // Validate pipeline has steps
    if (!pipeline.steps || pipeline.steps.length === 0) {
      throw new PipelineRegistryError(
        `Pipeline "${pipeline.name}" must have at least one step`
      );
    }

    this.pipelines.set(pipeline.name, pipeline);
  }

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
  public getPipeline(name: string): PipelineDefinition {
    const pipeline = this.pipelines.get(name);

    if (!pipeline) {
      throw new PipelineRegistryError(`Pipeline "${name}" not found`);
    }

    return pipeline;
  }

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
  public hasPipeline(name: string): boolean {
    return this.pipelines.has(name);
  }

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
  public listPipelines(): PipelineDefinition[] {
    return Array.from(this.pipelines.values());
  }

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
  public getPipelineNames(): string[] {
    return Array.from(this.pipelines.keys());
  }

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
  public unregisterPipeline(name: string): boolean {
    return this.pipelines.delete(name);
  }

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
  public clearRegistry(): void {
    this.pipelines.clear();
  }

  /**
   * Gets the count of registered pipelines
   * @returns Number of registered pipelines
   */
  public count(): number {
    return this.pipelines.size;
  }
}

// Export singleton instance
export const registry = PipelineRegistry.getInstance();

// Export class for testing
export { PipelineRegistry };
