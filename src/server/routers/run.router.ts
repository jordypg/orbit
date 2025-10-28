import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { runEvents, type RunStatusEvent } from '../../core/events.js';
import { registry } from '../../core/registry.js';
import { ensurePipelinesLoaded } from '../utils/pipeline-loader.js';

export const runRouter = createTRPCRouter({
  /**
   * Get all runs for a specific pipeline
   */
  getByPipeline: publicProcedure
    .input(
      z.object({
        pipelineId: z.string().cuid(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().cuid().optional(),
      })
    )
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
            orderBy: {
              startedAt: 'asc',
            },
          },
          _count: {
            select: {
              steps: true,
            },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (runs.length > limit) {
        const nextItem = runs.pop();
        nextCursor = nextItem?.id;
      }

      // Get pipeline definition from registry if available
      let stepDefinitions: Array<{ name: string; order: number }> = [];
      if (runs.length > 0) {
        try {
          await ensurePipelinesLoaded();
          const pipeline = await ctx.prisma.pipeline.findUnique({
            where: { id: pipelineId },
          });
          if (pipeline) {
            const pipelineDef = registry.getPipeline(pipeline.name);
            stepDefinitions = pipelineDef.steps.map((step, index) => ({
              name: step.name,
              order: index,
            }));
          }
        } catch (error) {
          // Pipeline not in registry, that's okay
          console.warn('Pipeline definition not found in registry');
        }
      }

      return {
        runs,
        nextCursor,
        stepDefinitions,
      };
    }),

  /**
   * Get a single run by ID with all its steps
   */
  get: publicProcedure
    .input(
      z.object({
        id: z.string().cuid(),
      })
    )
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

      // Get pipeline definition from registry if available
      let stepDefinitions: Array<{ name: string; order: number }> = [];
      try {
        await ensurePipelinesLoaded();
        const pipelineDef = registry.getPipeline(run.pipeline.name);
        stepDefinitions = pipelineDef.steps.map((step, index) => ({
          name: step.name,
          order: index,
        }));
      } catch (error) {
        // Pipeline not in registry, that's okay
        console.warn('Pipeline definition not found in registry');
      }

      return {
        ...run,
        stepDefinitions,
      };
    }),

  /**
   * Retry a failed run
   * This would trigger the retry logic in your core pipeline system
   */
  retry: publicProcedure
    .input(
      z.object({
        id: z.string().cuid(),
      })
    )
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
    .input(
      z.object({
        status: z.enum(['pending', 'running', 'success', 'failed']).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
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

  /**
   * Subscribe to run status updates for a specific pipeline
   * Streams real-time updates via Server-Sent Events
   */
  onStatusUpdate: publicProcedure
    .input(
      z.object({
        pipelineId: z.string().cuid(),
      })
    )
    .subscription(({ input }) => {
      console.log('[Subscription] Client subscribed to pipeline:', input.pipelineId);

      return observable<RunStatusEvent>((emit) => {
        const onStatusChange = (event: RunStatusEvent) => {
          console.log('[Subscription] Received event for pipeline:', event.pipelineId, 'requested:', input.pipelineId);

          // Only emit events for the requested pipeline
          if (event.pipelineId === input.pipelineId) {
            console.log('[Subscription] Emitting event to client:', event);
            emit.next(event);
          }
        };

        // Subscribe to the event emitter
        runEvents.on('runStatusChange', onStatusChange);
        console.log('[Subscription] Event listener attached');

        // Cleanup function - called when client disconnects
        return () => {
          console.log('[Subscription] Client unsubscribed from pipeline:', input.pipelineId);
          runEvents.off('runStatusChange', onStatusChange);
        };
      });
    }),
});
