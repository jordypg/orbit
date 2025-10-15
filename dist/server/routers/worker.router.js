import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc.js';
import { getMetricsSnapshot } from '../../core/metrics.js';
export const workerRouter = createTRPCRouter({
    /**
     * Get worker dashboard statistics
     */
    stats: publicProcedure.query(async ({ ctx }) => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        // Get counts for different run statuses
        const [pendingCount, runningCount, recentRuns, totalRuns, successCount, failedCount,] = await Promise.all([
            // Pending runs
            ctx.prisma.run.count({
                where: { status: 'pending' },
            }),
            // Running runs
            ctx.prisma.run.count({
                where: { status: 'running' },
            }),
            // Runs in the last hour
            ctx.prisma.run.count({
                where: {
                    startedAt: {
                        gte: oneHourAgo,
                    },
                },
            }),
            // Total runs in last 24 hours
            ctx.prisma.run.count({
                where: {
                    startedAt: {
                        gte: oneDayAgo,
                    },
                },
            }),
            // Successful runs in last 24 hours
            ctx.prisma.run.count({
                where: {
                    status: 'success',
                    startedAt: {
                        gte: oneDayAgo,
                    },
                },
            }),
            // Failed runs in last 24 hours
            ctx.prisma.run.count({
                where: {
                    status: 'failed',
                    startedAt: {
                        gte: oneDayAgo,
                    },
                },
            }),
        ]);
        // Calculate average duration for completed runs in last 24 hours
        const completedRuns = await ctx.prisma.run.findMany({
            where: {
                status: {
                    in: ['success', 'failed'],
                },
                startedAt: {
                    gte: oneDayAgo,
                },
                finishedAt: {
                    not: null,
                },
            },
            select: {
                startedAt: true,
                finishedAt: true,
            },
        });
        const avgDuration = completedRuns.length > 0
            ? completedRuns.reduce((sum, run) => {
                const duration = run.finishedAt.getTime() - run.startedAt.getTime();
                return sum + duration;
            }, 0) / completedRuns.length
            : 0;
        // Calculate error rate
        const errorRate = totalRuns > 0 ? (failedCount / totalRuns) * 100 : 0;
        return {
            pending: pendingCount,
            running: runningCount,
            runsLastHour: recentRuns,
            runsLast24Hours: totalRuns,
            successCount,
            failedCount,
            avgDurationMs: Math.round(avgDuration),
            errorRate: Math.round(errorRate * 10) / 10, // Round to 1 decimal
        };
    }),
    /**
     * Get recent runs with full details
     */
    recentRuns: publicProcedure
        .input(z.object({
        limit: z.number().min(1).max(100).default(20),
        status: z
            .enum(['pending', 'running', 'success', 'failed'])
            .optional(),
    }))
        .query(async ({ ctx, input }) => {
        const runs = await ctx.prisma.run.findMany({
            where: input.status
                ? {
                    status: input.status,
                }
                : undefined,
            orderBy: {
                startedAt: 'desc',
            },
            take: input.limit,
            include: {
                pipeline: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                    },
                },
                steps: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        attemptCount: true,
                    },
                    orderBy: {
                        startedAt: 'asc',
                    },
                },
            },
        });
        return runs;
    }),
    /**
     * Get worker health status
     * This checks if there are any recent run updates to determine if worker is active
     */
    health: publicProcedure.query(async ({ ctx }) => {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        // Check for any runs that were updated in the last 5 minutes
        const recentActivity = await ctx.prisma.run.findFirst({
            where: {
                startedAt: {
                    gte: fiveMinutesAgo,
                },
            },
            orderBy: {
                startedAt: 'desc',
            },
            select: {
                id: true,
                startedAt: true,
                status: true,
            },
        });
        // Check for stuck running runs (running for more than 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const stuckRuns = await ctx.prisma.run.count({
            where: {
                status: 'running',
                startedAt: {
                    lt: tenMinutesAgo,
                },
            },
        });
        // Determine health status
        let status = 'healthy';
        let message = 'Worker is processing runs normally';
        if (stuckRuns > 0) {
            status = 'warning';
            message = `${stuckRuns} run(s) appear to be stuck`;
        }
        else if (!recentActivity) {
            status = 'warning';
            message = 'No recent activity detected';
        }
        return {
            status,
            message,
            lastActivity: recentActivity?.startedAt || null,
            stuckRuns,
        };
    }),
    /**
     * Get worker performance metrics
     * Returns real-time metrics from the worker process
     */
    metrics: publicProcedure.query(() => {
        try {
            const snapshot = getMetricsSnapshot();
            return {
                // Derived metrics (human-readable)
                uptime: snapshot.derived.uptimeFormatted,
                uptimeSeconds: snapshot.derived.uptime,
                totalRuns: snapshot.derived.totalRuns,
                successRate: snapshot.derived.successRate,
                errorRate: snapshot.derived.errorRate,
                runsPerHour: snapshot.derived.runsPerHour,
                avgExecutionTime: snapshot.derived.avgExecutionTime,
                minExecutionTime: snapshot.derived.minExecutionTime,
                maxExecutionTime: snapshot.derived.maxExecutionTime,
                // Counts
                succeeded: snapshot.derived.totalSucceeded,
                failed: snapshot.derived.totalFailed,
                // Timing
                workerStartTime: new Date(snapshot.raw.workerStartTime),
                lastRunTime: snapshot.raw.lastRunTime > 0
                    ? new Date(snapshot.raw.lastRunTime)
                    : null,
                // Timestamp
                timestamp: new Date(snapshot.timestamp),
            };
        }
        catch (error) {
            // If metrics aren't available (e.g., worker not running), return null data
            return {
                uptime: '0s',
                uptimeSeconds: 0,
                totalRuns: 0,
                successRate: 0,
                errorRate: 0,
                runsPerHour: 0,
                avgExecutionTime: 0,
                minExecutionTime: 0,
                maxExecutionTime: 0,
                succeeded: 0,
                failed: 0,
                workerStartTime: null,
                lastRunTime: null,
                timestamp: new Date(),
            };
        }
    }),
});
//# sourceMappingURL=worker.router.js.map