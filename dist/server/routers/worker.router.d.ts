import { z } from 'zod';
export declare const workerRouter: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
    ctx: {
        prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
    };
    meta: object;
    errorShape: {
        data: {
            zodError: z.core.$ZodFlattenedError<unknown, string> | null;
            code: import("@trpc/server/rpc").TRPC_ERROR_CODE_KEY;
            httpStatus: number;
            path?: string;
            stack?: string;
        };
        message: string;
        code: import("@trpc/server/rpc").TRPC_ERROR_CODE_NUMBER;
    };
    transformer: typeof import("superjson").default;
}>, {
    /**
     * Get worker dashboard statistics
     */
    stats: import("@trpc/server").BuildProcedure<"query", {
        _config: import("@trpc/server").RootConfig<{
            ctx: {
                prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
            };
            meta: object;
            errorShape: {
                data: {
                    zodError: z.core.$ZodFlattenedError<unknown, string> | null;
                    code: import("@trpc/server/rpc").TRPC_ERROR_CODE_KEY;
                    httpStatus: number;
                    path?: string;
                    stack?: string;
                };
                message: string;
                code: import("@trpc/server/rpc").TRPC_ERROR_CODE_NUMBER;
            };
            transformer: typeof import("superjson").default;
        }>;
        _ctx_out: {
            prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
        };
        _input_in: typeof import("@trpc/server").unsetMarker;
        _input_out: typeof import("@trpc/server").unsetMarker;
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
        _meta: object;
    }, {
        pending: number;
        running: number;
        runsLastHour: number;
        runsLast24Hours: number;
        successCount: number;
        failedCount: number;
        avgDurationMs: number;
        errorRate: number;
    }>;
    /**
     * Get recent runs with full details
     */
    recentRuns: import("@trpc/server").BuildProcedure<"query", {
        _config: import("@trpc/server").RootConfig<{
            ctx: {
                prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
            };
            meta: object;
            errorShape: {
                data: {
                    zodError: z.core.$ZodFlattenedError<unknown, string> | null;
                    code: import("@trpc/server/rpc").TRPC_ERROR_CODE_KEY;
                    httpStatus: number;
                    path?: string;
                    stack?: string;
                };
                message: string;
                code: import("@trpc/server/rpc").TRPC_ERROR_CODE_NUMBER;
            };
            transformer: typeof import("superjson").default;
        }>;
        _meta: object;
        _ctx_out: {
            prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
        };
        _input_in: {
            limit?: number | undefined;
            status?: "pending" | "running" | "success" | "failed" | undefined;
        };
        _input_out: {
            limit: number;
            status?: "pending" | "running" | "success" | "failed" | undefined;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, ({
        pipeline: {
            name: string;
            id: string;
            description: string | null;
        };
        steps: {
            name: string;
            id: string;
            status: string;
            attemptCount: number;
        }[];
    } & {
        id: string;
        pipelineId: string;
        startedAt: Date;
        finishedAt: Date | null;
        status: string;
        triggeredBy: string | null;
    })[]>;
    /**
     * Get worker health status
     * This checks if there are any recent run updates to determine if worker is active
     */
    health: import("@trpc/server").BuildProcedure<"query", {
        _config: import("@trpc/server").RootConfig<{
            ctx: {
                prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
            };
            meta: object;
            errorShape: {
                data: {
                    zodError: z.core.$ZodFlattenedError<unknown, string> | null;
                    code: import("@trpc/server/rpc").TRPC_ERROR_CODE_KEY;
                    httpStatus: number;
                    path?: string;
                    stack?: string;
                };
                message: string;
                code: import("@trpc/server/rpc").TRPC_ERROR_CODE_NUMBER;
            };
            transformer: typeof import("superjson").default;
        }>;
        _ctx_out: {
            prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
        };
        _input_in: typeof import("@trpc/server").unsetMarker;
        _input_out: typeof import("@trpc/server").unsetMarker;
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
        _meta: object;
    }, {
        status: "warning" | "healthy";
        message: string;
        lastActivity: Date | null;
        stuckRuns: number;
    }>;
    /**
     * Get worker performance metrics
     * Returns real-time metrics from the worker process
     */
    metrics: import("@trpc/server").BuildProcedure<"query", {
        _config: import("@trpc/server").RootConfig<{
            ctx: {
                prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
            };
            meta: object;
            errorShape: {
                data: {
                    zodError: z.core.$ZodFlattenedError<unknown, string> | null;
                    code: import("@trpc/server/rpc").TRPC_ERROR_CODE_KEY;
                    httpStatus: number;
                    path?: string;
                    stack?: string;
                };
                message: string;
                code: import("@trpc/server/rpc").TRPC_ERROR_CODE_NUMBER;
            };
            transformer: typeof import("superjson").default;
        }>;
        _ctx_out: {
            prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
        };
        _input_in: typeof import("@trpc/server").unsetMarker;
        _input_out: typeof import("@trpc/server").unsetMarker;
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
        _meta: object;
    }, {
        uptime: string;
        uptimeSeconds: number;
        totalRuns: number;
        successRate: number;
        errorRate: number;
        runsPerHour: number;
        avgExecutionTime: number;
        minExecutionTime: number;
        maxExecutionTime: number;
        succeeded: number;
        failed: number;
        workerStartTime: Date;
        lastRunTime: Date | null;
        timestamp: Date;
    } | {
        uptime: string;
        uptimeSeconds: number;
        totalRuns: number;
        successRate: number;
        errorRate: number;
        runsPerHour: number;
        avgExecutionTime: number;
        minExecutionTime: number;
        maxExecutionTime: number;
        succeeded: number;
        failed: number;
        workerStartTime: null;
        lastRunTime: null;
        timestamp: Date;
    }>;
}>;
//# sourceMappingURL=worker.router.d.ts.map