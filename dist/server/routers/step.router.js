import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
export const stepRouter = createTRPCRouter({
    /**
     * Get logs and details for a specific step
     */
    getLogs: publicProcedure
        .input(z.object({
        id: z.string().cuid(),
    }))
        .query(async ({ ctx, input }) => {
        const step = await ctx.prisma.step.findUnique({
            where: {
                id: input.id,
            },
            include: {
                run: {
                    include: {
                        pipeline: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });
        if (!step) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: `Step with id ${input.id} not found`,
            });
        }
        return {
            ...step,
            // Parse error and result as JSON if they exist
            errorParsed: step.error ? tryParseJSON(step.error) : null,
            resultParsed: step.result ? tryParseJSON(step.result) : null,
        };
    }),
    /**
     * Get all steps for a specific run
     */
    getByRun: publicProcedure
        .input(z.object({
        runId: z.string().cuid(),
    }))
        .query(async ({ ctx, input }) => {
        const steps = await ctx.prisma.step.findMany({
            where: {
                runId: input.runId,
            },
            orderBy: {
                startedAt: 'asc',
            },
        });
        return steps;
    }),
    /**
     * Get a single step by ID
     */
    get: publicProcedure
        .input(z.object({
        id: z.string().cuid(),
    }))
        .query(async ({ ctx, input }) => {
        const step = await ctx.prisma.step.findUnique({
            where: {
                id: input.id,
            },
            include: {
                run: {
                    include: {
                        pipeline: true,
                    },
                },
            },
        });
        if (!step) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: `Step with id ${input.id} not found`,
            });
        }
        return step;
    }),
    /**
     * List steps with optional filtering
     */
    list: publicProcedure
        .input(z.object({
        status: z
            .enum(['pending', 'running', 'success', 'failed', 'retrying'])
            .optional(),
        limit: z.number().min(1).max(100).default(50),
    }))
        .query(async ({ ctx, input }) => {
        const steps = await ctx.prisma.step.findMany({
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
                run: {
                    select: {
                        id: true,
                        pipelineId: true,
                        status: true,
                    },
                },
            },
        });
        return steps;
    }),
});
/**
 * Helper function to safely parse JSON strings
 */
function tryParseJSON(jsonString) {
    try {
        return JSON.parse(jsonString);
    }
    catch {
        return jsonString;
    }
}
//# sourceMappingURL=step.router.js.map