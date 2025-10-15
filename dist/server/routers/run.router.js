import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
export const runRouter = createTRPCRouter({
    /**
     * Get all runs for a specific pipeline
     */
    getByPipeline: publicProcedure
        .input(z.object({
        pipelineId: z.string().cuid(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().cuid().optional(),
    }))
        .query(async ({ ctx, input }) => {
        const { pipelineId, limit, cursor } = input;
        const runs = await ctx.prisma.run.findMany({
            where: {
                pipelineId,
            },
            orderBy: {
                startedAt: 'desc',
            },
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            include: {
                steps: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        attemptCount: true,
                    },
                },
                _count: {
                    select: {
                        steps: true,
                    },
                },
            },
        });
        let nextCursor = undefined;
        if (runs.length > limit) {
            const nextItem = runs.pop();
            nextCursor = nextItem?.id;
        }
        return {
            runs,
            nextCursor,
        };
    }),
    /**
     * Get a single run by ID with all its steps
     */
    get: publicProcedure
        .input(z.object({
        id: z.string().cuid(),
    }))
        .query(async ({ ctx, input }) => {
        const run = await ctx.prisma.run.findUnique({
            where: {
                id: input.id,
            },
            include: {
                pipeline: true,
                steps: {
                    orderBy: {
                        startedAt: 'asc',
                    },
                },
            },
        });
        if (!run) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: `Run with id ${input.id} not found`,
            });
        }
        return run;
    }),
    /**
     * Retry a failed run
     * This would trigger the retry logic in your core pipeline system
     */
    retry: publicProcedure
        .input(z.object({
        id: z.string().cuid(),
    }))
        .mutation(async ({ ctx, input }) => {
        // First, get the run to verify it exists and is in a failed state
        const run = await ctx.prisma.run.findUnique({
            where: {
                id: input.id,
            },
            include: {
                steps: true,
                pipeline: true,
            },
        });
        if (!run) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: `Run with id ${input.id} not found`,
            });
        }
        if (run.status !== 'failed') {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `Can only retry failed runs. Current status: ${run.status}`,
            });
        }
        // Create a new run for the retry
        const newRun = await ctx.prisma.run.create({
            data: {
                pipelineId: run.pipelineId,
                triggeredBy: 'manual_retry',
                status: 'pending',
            },
            include: {
                pipeline: true,
            },
        });
        // Note: The actual retry execution would be handled by your pipeline system
        // This just creates the database record for the new run
        return newRun;
    }),
    /**
     * List all runs with optional filtering
     */
    list: publicProcedure
        .input(z.object({
        status: z.enum(['pending', 'running', 'success', 'failed']).optional(),
        limit: z.number().min(1).max(100).default(50),
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
                    },
                },
                _count: {
                    select: {
                        steps: true,
                    },
                },
            },
        });
        return runs;
    }),
});
//# sourceMappingURL=run.router.js.map