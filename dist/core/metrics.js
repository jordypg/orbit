/**
 * Worker Metrics Collection System
 * Tracks runs executed, execution duration, error rate, and performance metrics
 */
import { logger } from "./logger.js";
/**
 * Metrics Collector singleton class
 */
export class MetricsCollector {
    metrics;
    RECENT_WINDOW_MS = 3600000; // 1 hour
    MAX_RECENT_EXECUTIONS = 1000;
    reportInterval = null;
    constructor() {
        this.metrics = {
            runsExecuted: 0,
            runsSucceeded: 0,
            runsFailed: 0,
            totalExecutionTime: 0,
            minExecutionTime: Infinity,
            maxExecutionTime: 0,
            workerStartTime: Date.now(),
            lastRunTime: 0,
            lastReportTime: Date.now(),
            recentExecutions: [],
        };
    }
    /**
     * Record a run execution
     */
    recordRun(duration, success) {
        this.metrics.runsExecuted++;
        this.metrics.totalExecutionTime += duration;
        this.metrics.lastRunTime = Date.now();
        if (success) {
            this.metrics.runsSucceeded++;
        }
        else {
            this.metrics.runsFailed++;
        }
        // Update min/max
        if (duration < this.metrics.minExecutionTime) {
            this.metrics.minExecutionTime = duration;
        }
        if (duration > this.metrics.maxExecutionTime) {
            this.metrics.maxExecutionTime = duration;
        }
        // Add to recent executions
        this.metrics.recentExecutions.push({
            timestamp: Date.now(),
            duration,
            success,
        });
        // Prune old executions
        this.pruneOldExecutions();
    }
    /**
     * Remove executions older than the recent window
     */
    pruneOldExecutions() {
        const cutoff = Date.now() - this.RECENT_WINDOW_MS;
        this.metrics.recentExecutions = this.metrics.recentExecutions.filter((exec) => exec.timestamp > cutoff);
        // Also limit by max count
        if (this.metrics.recentExecutions.length > this.MAX_RECENT_EXECUTIONS) {
            this.metrics.recentExecutions = this.metrics.recentExecutions.slice(-this.MAX_RECENT_EXECUTIONS);
        }
    }
    /**
     * Calculate derived metrics from raw data
     */
    getDerivedMetrics() {
        const totalRuns = this.metrics.runsExecuted;
        // Calculate rates
        const errorRate = totalRuns > 0 ? (this.metrics.runsFailed / totalRuns) * 100 : 0;
        const successRate = totalRuns > 0 ? (this.metrics.runsSucceeded / totalRuns) * 100 : 0;
        // Calculate average execution time
        const avgExecutionTime = totalRuns > 0 ? this.metrics.totalExecutionTime / totalRuns : 0;
        // Calculate uptime
        const uptime = Math.floor((Date.now() - this.metrics.workerStartTime) / 1000);
        const uptimeFormatted = this.formatUptime(uptime);
        // Calculate runs per hour (using recent executions)
        const recentCount = this.metrics.recentExecutions.length;
        const recentWindowHours = this.RECENT_WINDOW_MS / 3600000;
        const runsPerHour = recentWindowHours > 0 ? recentCount / recentWindowHours : 0;
        // Handle infinity values
        const minExecutionTime = this.metrics.minExecutionTime === Infinity ? 0 : this.metrics.minExecutionTime;
        return {
            errorRate: Math.round(errorRate * 100) / 100, // 2 decimal places
            successRate: Math.round(successRate * 100) / 100,
            runsPerHour: Math.round(runsPerHour * 100) / 100,
            avgExecutionTime: Math.round(avgExecutionTime),
            minExecutionTime: Math.round(minExecutionTime),
            maxExecutionTime: Math.round(this.metrics.maxExecutionTime),
            uptime,
            uptimeFormatted,
            totalRuns,
            totalSucceeded: this.metrics.runsSucceeded,
            totalFailed: this.metrics.runsFailed,
        };
    }
    /**
     * Format uptime in human-readable format
     */
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        const parts = [];
        if (days > 0)
            parts.push(`${days}d`);
        if (hours > 0)
            parts.push(`${hours}h`);
        if (minutes > 0)
            parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0)
            parts.push(`${secs}s`);
        return parts.join(" ");
    }
    /**
     * Get raw metrics data
     */
    getRawMetrics() {
        return { ...this.metrics };
    }
    /**
     * Get complete metrics snapshot (raw + derived)
     */
    getMetricsSnapshot() {
        return {
            raw: this.getRawMetrics(),
            derived: this.getDerivedMetrics(),
            timestamp: Date.now(),
        };
    }
    /**
     * Log current metrics to console
     */
    logMetrics() {
        const derived = this.getDerivedMetrics();
        logger.info("Worker Metrics Report", {
            uptime: derived.uptimeFormatted,
            totalRuns: derived.totalRuns,
            succeeded: derived.totalSucceeded,
            failed: derived.totalFailed,
            errorRate: `${derived.errorRate.toFixed(2)}%`,
            successRate: `${derived.successRate.toFixed(2)}%`,
            runsPerHour: derived.runsPerHour.toFixed(2),
            avgDuration: `${derived.avgExecutionTime}ms`,
            minDuration: `${derived.minExecutionTime}ms`,
            maxDuration: `${derived.maxExecutionTime}ms`,
        });
        this.metrics.lastReportTime = Date.now();
    }
    /**
     * Start periodic metrics reporting
     */
    startPeriodicReporting(intervalMs = 60000) {
        if (this.reportInterval) {
            this.stopPeriodicReporting();
        }
        logger.info("Starting periodic metrics reporting", {
            intervalSeconds: intervalMs / 1000,
        });
        this.reportInterval = setInterval(() => {
            this.logMetrics();
        }, intervalMs);
    }
    /**
     * Stop periodic metrics reporting
     */
    stopPeriodicReporting() {
        if (this.reportInterval) {
            clearInterval(this.reportInterval);
            this.reportInterval = null;
            logger.info("Stopped periodic metrics reporting");
        }
    }
    /**
     * Reset all metrics (useful for testing)
     */
    reset() {
        this.metrics = {
            runsExecuted: 0,
            runsSucceeded: 0,
            runsFailed: 0,
            totalExecutionTime: 0,
            minExecutionTime: Infinity,
            maxExecutionTime: 0,
            workerStartTime: Date.now(),
            lastRunTime: 0,
            lastReportTime: Date.now(),
            recentExecutions: [],
        };
        logger.info("Metrics reset");
    }
}
// Singleton instance
export const metricsCollector = new MetricsCollector();
/**
 * Convenience function to record a run
 */
export function recordRun(duration, success) {
    metricsCollector.recordRun(duration, success);
}
/**
 * Convenience function to get metrics
 */
export function getMetrics() {
    return metricsCollector.getDerivedMetrics();
}
/**
 * Convenience function to get full snapshot
 */
export function getMetricsSnapshot() {
    return metricsCollector.getMetricsSnapshot();
}
/**
 * Convenience function to start periodic reporting
 */
export function startMetricsReporting(intervalMs) {
    metricsCollector.startPeriodicReporting(intervalMs);
}
/**
 * Convenience function to stop periodic reporting
 */
export function stopMetricsReporting() {
    metricsCollector.stopPeriodicReporting();
}
//# sourceMappingURL=metrics.js.map