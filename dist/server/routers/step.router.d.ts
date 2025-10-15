import { z } from 'zod';
export declare const stepRouter: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
     * Get logs and details for a specific step
     */
    getLogs: import("@trpc/server").BuildProcedure<"query", {
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
        errorParsed: any;
        resultParsed: any;
        run: {
            pipeline: {
                name: string;
                id: string;
            };
        } & {
            id: string;
            pipelineId: string;
            startedAt: Date;
            finishedAt: Date | null;
            status: string;
            triggeredBy: string | null;
        };
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
    }>;
    /**
     * Get all steps for a specific run
     */
    getByRun: import("@trpc/server").BuildProcedure<"query", {
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
            runId: string;
        };
        _input_out: {
            runId: string;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, {
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
    }[]>;
    /**
     * Get a single step by ID
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
        run: {
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
        };
    } & {
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
    }>;
    /**
     * List steps with optional filtering
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
            status?: "pending" | "running" | "retrying" | "success" | "failed" | undefined;
            limit?: number | undefined;
        };
        _input_out: {
            limit: number;
            status?: "pending" | "running" | "retrying" | "success" | "failed" | undefined;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, ({
        run: {
            id: string;
            pipelineId: string;
            status: string;
        };
    } & {
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
    })[]>;
}>;
//# sourceMappingURL=step.router.d.ts.map