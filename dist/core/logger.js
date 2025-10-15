/**
 * Winston Logger Configuration
 * Provides structured logging for the worker process
 */
import winston from "winston";
import { join } from "path";
const { combine, timestamp, printf, colorize, errors } = winston.format;
/**
 * Custom log format with timestamps and metadata
 */
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let metaStr = "";
    // Extract and format metadata
    if (Object.keys(metadata).length > 0) {
        const { stack, ...rest } = metadata;
        if (Object.keys(rest).length > 0) {
            metaStr = ` ${JSON.stringify(rest)}`;
        }
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
});
/**
 * Create logs directory path
 */
const logsDir = process.env.LOGS_DIR || join(process.cwd(), "logs");
/**
 * Main logger instance
 */
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: combine(errors({ stack: true }), // Include stack traces for errors
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
    transports: [
        // Console transport for development
        new winston.transports.Console({
            format: combine(colorize(), timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
        }),
        // File transport for all logs
        new winston.transports.File({
            filename: join(logsDir, "worker.log"),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
        }),
        // Separate file for errors
        new winston.transports.File({
            filename: join(logsDir, "worker-error.log"),
            level: "error",
            maxsize: 10485760, // 10MB
            maxFiles: 5,
        }),
    ],
    // Don't exit on handled exceptions
    exitOnError: false,
});
/**
 * Context-aware logger that includes runId and pipelineId
 */
export class ContextLogger {
    context;
    constructor(context = {}) {
        this.context = context;
    }
    /**
     * Add additional context to all log messages
     */
    addContext(context) {
        this.context = { ...this.context, ...context };
    }
    /**
     * Log info message with context
     */
    info(message, meta) {
        logger.info(message, { ...this.context, ...meta });
    }
    /**
     * Log error message with context
     */
    error(message, error, meta) {
        const errorMeta = { ...this.context, ...meta };
        if (error instanceof Error) {
            errorMeta.error = error.message;
            errorMeta.stack = error.stack;
        }
        else if (error) {
            errorMeta.error = String(error);
        }
        logger.error(message, errorMeta);
    }
    /**
     * Log warning message with context
     */
    warn(message, meta) {
        logger.warn(message, { ...this.context, ...meta });
    }
    /**
     * Log debug message with context
     */
    debug(message, meta) {
        logger.debug(message, { ...this.context, ...meta });
    }
}
/**
 * Create a logger with specific context
 */
export function createLogger(context) {
    return new ContextLogger(context);
}
// Export default logger for general use
export default logger;
//# sourceMappingURL=logger.js.map