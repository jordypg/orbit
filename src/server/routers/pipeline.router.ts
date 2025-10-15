import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';

export const pipelineRouter = createTRPCRouter({
  /**
   * List all pipelines
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const pipelines = await ctx.prisma.pipeline.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            runs: true,
          },
        },
      },
    });

    return pipelines;
  }),

  /**
   * Get a single pipeline by ID
   */
  get: publicProcedure
    .input(
      z.object({
        id: z.string().cuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const pipeline = await ctx.prisma.pipeline.findUnique({
        where: {
          id: input.id,
        },
        include: {
          runs: {
            orderBy: {
              startedAt: 'desc',
            },
            take: 10,
          },
          _count: {
            select: {
              runs: true,
            },
          },
        },
      });

      if (!pipeline) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Pipeline with id ${input.id} not found`,
        });
      }

      return pipeline;
    }),

  /**
   * Create a new pipeline
   */
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        schedule: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pipeline = await ctx.prisma.pipeline.create({
        data: {
          name: input.name,
          description: input.description,
          schedule: input.schedule,
        },
      });

      return pipeline;
    }),

  /**
   * Update an existing pipeline
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        schedule: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const pipeline = await ctx.prisma.pipeline.update({
        where: { id },
        data,
      });

      return pipeline;
    }),

  /**
   * Delete a pipeline
   */
  delete: publicProcedure
    .input(
      z.object({
        id: z.string().cuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.pipeline.delete({
        where: {
          id: input.id,
        },
      });

      return { success: true };
    }),

  /**
   * Trigger a pipeline run
   * Creates a new run record - actual execution would be handled by the pipeline executor
   */
  trigger: publicProcedure
    .input(
      z.object({
        id: z.string().cuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify pipeline exists
      const pipeline = await ctx.prisma.pipeline.findUnique({
        where: { id: input.id },
      });

      if (!pipeline) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Pipeline with id ${input.id} not found`,
        });
      }

      // Create a new run
      const run = await ctx.prisma.run.create({
        data: {
          pipelineId: input.id,
          status: 'pending',
          triggeredBy: 'manual',
        },
        include: {
          pipeline: true,
        },
      });

      // Note: In a real implementation, this would trigger the actual pipeline execution
      // For now, we just create the database record

      return run;
    }),
});
