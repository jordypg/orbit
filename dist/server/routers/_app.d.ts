/**
 * Main application router
 * Combines all resource routers
 */
export declare const appRouter: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
    ctx: {
        prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
    };
    meta: object;
    errorShape: {
        data: {
            zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
    pipeline: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
        ctx: {
            prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
        };
        meta: object;
        errorShape: {
            data: {
                zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
        list: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
        }, ({
            _count: {
                runs: number;
            };
        } & {
            name: string;
            id: string;
            description: string | null;
            schedule: string | null;
            createdAt: Date;
            updatedAt: Date;
        })[]>;
        get: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
            _count: {
                runs: number;
            };
            runs: {
                id: string;
                pipelineId: string;
                startedAt: Date;
                finishedAt: Date | null;
                status: string;
                triggeredBy: string | null;
            }[];
        } & {
            name: string;
            id: string;
            description: string | null;
            schedule: string | null;
            createdAt: Date;
            updatedAt: Date;
        }>;
        create: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
                name: string;
                description?: string | undefined;
                schedule?: string | undefined;
            };
            _input_out: {
                name: string;
                description?: string | undefined;
                schedule?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            name: string;
            id: string;
            description: string | null;
            schedule: string | null;
            createdAt: Date;
            updatedAt: Date;
        }>;
        update: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
                name?: string | undefined;
                description?: string | undefined;
                schedule?: string | undefined;
            };
            _input_out: {
                id: string;
                name?: string | undefined;
                description?: string | undefined;
                schedule?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            name: string;
            id: string;
            description: string | null;
            schedule: string | null;
            createdAt: Date;
            updatedAt: Date;
        }>;
        delete: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
            success: boolean;
        }>;
        trigger: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
    }>;
    run: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
        ctx: {
            prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
        };
        meta: object;
        errorShape: {
            data: {
                zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
        getByPipeline: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
        get: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
        retry: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
        list: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
    step: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
        ctx: {
            prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
        };
        meta: object;
        errorShape: {
            data: {
                zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
        getLogs: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
        getByRun: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
        get: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
        list: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
    worker: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
        ctx: {
            prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
        };
        meta: object;
        errorShape: {
            data: {
                zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
        stats: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
        recentRuns: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
        health: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
        metrics: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: {
                    prisma: import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
                };
                meta: object;
                errorShape: {
                    data: {
                        zodError: import("zod").ZodFlattenedError<unknown, string> | null;
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
}>;
export type AppRouter = typeof appRouter;
//# sourceMappingURL=_app.d.ts.map