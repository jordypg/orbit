/**
 * Winston Logger Configuration
 * Provides structured logging for the worker process
 */
import winston from "winston";
/**
 * Main logger instance
 */
export declare const logger: winston.Logger;
/**
 * Context-aware logger that includes runId and pipelineId
 */
export declare class ContextLogger {
    private context;
    constructor(context?: {
        runId?: string;
        pipelineId?: string;
        pipelineName?: string;
        [key: string]: any;
    });
    /**
     * Add additional context to all log messages
     */
    addContext(context: Record<string, any>): void;
    /**
     * Log info message with context
     */
    info(message: string, meta?: Record<string, any>): void;
    /**
     * Log error message with context
     */
    error(message: string, error?: Error | unknown, meta?: Record<string, any>): void;
    /**
     * Log warning message with context
     */
    warn(message: string, meta?: Record<string, any>): void;
    /**
     * Log debug message with context
     */
    debug(message: string, meta?: Record<string, any>): void;
}
/**
 * Create a logger with specific context
 */
export declare function createLogger(context: {
    runId?: string;
    pipelineId?: string;
    pipelineName?: string;
    [key: string]: any;
}): ContextLogger;
export default logger;
//# sourceMappingURL=logger.d.ts.map