import { z } from 'zod';
export declare const runRouter: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
     * Get all runs for a specific pipeline
     */
    getByPipeline: import("@trpc/server").BuildProcedure<"query", {
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
            pipelineId: string;
            limit?: number | undefined;
            cursor?: string | undefined;
        };
        _input_out: {
            pipelineId: string;
            limit: number;
            cursor?: string | undefined;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, {
        runs: ({
            steps: {
                name: string;
                id: string;
                status: string;
                attemptCount: number;
            }[];
            _count: {
                steps: number;
            };
        } & {
            id: string;
            pipelineId: string;
            startedAt: Date;
            finishedAt: Date | null;
            status: string;
            triggeredBy: string | null;
        })[];
        nextCursor: string | undefined;
    }>;
    /**
     * Get a single run by ID with all its steps
     */
    get: import("@trpc/server").BuildProcedure<"query", {
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
            id: string;
        };
        _input_out: {
            id: string;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, {
        pipeline: {
            name: string;
            id: string;
            description: string | null;
            schedule: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
        steps: {
            error: string | null;
            name: string;
            result: string | null;
            id: string;
            startedAt: Date | null;
            finishedAt: Date | null;
            status: string;
            runId: string;
            attemptCount: number;
            nextRetryAt: Date | null;
        }[];
    } & {
        id: string;
        pipelineId: string;
        startedAt: Date;
        finishedAt: Date | null;
        status: string;
        triggeredBy: string | null;
    }>;
    /**
     * Retry a failed run
     * This would trigger the retry logic in your core pipeline system
     */
    retry: import("@trpc/server").BuildProcedure<"mutation", {
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
            id: string;
        };
        _input_out: {
            id: string;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, {
        pipeline: {
            name: string;
            id: string;
            description: string | null;
            schedule: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: string;
        pipelineId: string;
        startedAt: Date;
        finishedAt: Date | null;
        status: string;
        triggeredBy: string | null;
    }>;
    /**
     * List all runs with optional filtering
     */
    list: import("@trpc/server").BuildProcedure<"query", {
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
            status?: "pending" | "running" | "success" | "failed" | undefined;
            limit?: number | undefined;
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
        };
        _count: {
            steps: number;
        };
    } & {
        id: string;
        pipelineId: string;
        startedAt: Date;
        finishedAt: Date | null;
        status: string;
        triggeredBy: string | null;
    })[]>;
}>;
//# sourceMappingURL=run.router.d.ts.map