/**
 * Worker Metrics Collection System
 * Tracks runs executed, execution duration, error rate, and performance metrics
 */
/**
 * Metrics data structure
 */
export interface WorkerMetrics {
    runsExecuted: number;
    runsSucceeded: number;
    runsFailed: number;
    totalExecutionTime: number;
    minExecutionTime: number;
    maxExecutionTime: number;
    workerStartTime: number;
    lastRunTime: number;
    lastReportTime: number;
    recentExecutions: Array<{
        timestamp: number;
        duration: number;
        success: boolean;
    }>;
}
/**
 * Derived metrics calculated from raw data
 */
export interface DerivedMetrics {
    errorRate: number;
    successRate: number;
    runsPerHour: number;
    avgExecutionTime: number;
    minExecutionTime: number;
    maxExecutionTime: number;
    uptime: number;
    uptimeFormatted: string;
    totalRuns: number;
    totalSucceeded: number;
    totalFailed: number;
}
/**
 * Metrics Collector singleton class
 */
export declare class MetricsCollector {
    private metrics;
    private readonly RECENT_WINDOW_MS;
    private readonly MAX_RECENT_EXECUTIONS;
    private reportInterval;
    constructor();
    /**
     * Record a run execution
     */
    recordRun(duration: number, success: boolean): void;
    /**
     * Remove executions older than the recent window
     */
    private pruneOldExecutions;
    /**
     * Calculate derived metrics from raw data
     */
    getDerivedMetrics(): DerivedMetrics;
    /**
     * Format uptime in human-readable format
     */
    private formatUptime;
    /**
     * Get raw metrics data
     */
    getRawMetrics(): WorkerMetrics;
    /**
     * Get complete metrics snapshot (raw + derived)
     */
    getMetricsSnapshot(): {
        raw: WorkerMetrics;
        derived: DerivedMetrics;
        timestamp: number;
    };
    /**
     * Log current metrics to console
     */
    logMetrics(): void;
    /**
     * Start periodic metrics reporting
     */
    startPeriodicReporting(intervalMs?: number): void;
    /**
     * Stop periodic metrics reporting
     */
    stopPeriodicReporting(): void;
    /**
     * Reset all metrics (useful for testing)
     */
    reset(): void;
}
export declare const metricsCollector: MetricsCollector;
/**
 * Convenience function to record a run
 */
export declare function recordRun(duration: number, success: boolean): void;
/**
 * Convenience function to get metrics
 */
export declare function getMetrics(): DerivedMetrics;
/**
 * Convenience function to get full snapshot
 */
export declare function getMetricsSnapshot(): ReturnType<typeof metricsCollector.getMetricsSnapshot>;
/**
 * Convenience function to start periodic reporting
 */
export declare function startMetricsReporting(intervalMs?: number): void;
/**
 * Convenience function to stop periodic reporting
 */
export declare function stopMetricsReporting(): void;
//# sourceMappingURL=metrics.d.ts.map