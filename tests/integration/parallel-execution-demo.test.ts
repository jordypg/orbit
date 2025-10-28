/**
 * Parallel Execution Demo Pipeline Integration Tests
 *
 * Tests for the parallel execution demonstration pipeline including:
 * - Performance validation (parallel vs sequential timing)
 * - Result aggregation from concurrent tasks
 * - Error handling when parallel tasks fail
 */

import { describe, it, expect } from '@jest/globals';
import { PipelineExecutor } from '../../src/core/executor.js';
import parallelExecutionPipeline from '../../src/pipelines/parallel-execution-demo.js';
import { definePipeline, step } from '../../src/core/index.js';
import type { StepContext, StepResult } from '../../src/core/types.js';
import type { AggregatedResults, ParallelTaskResult } from '../../src/pipelines/parallel-execution-demo.js';

describe('Parallel Execution Demo Pipeline', () => {
  describe('Success Path', () => {
    it('should complete all steps successfully', async () => {
      console.log('\n🧪 TEST: Parallel Execution Demo - Full pipeline\n');

      const executor = new PipelineExecutor(parallelExecutionPipeline);
      const result = await executor.execute({ metadata: {} });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify all 3 steps completed
      const stepResults = result.stepResults || {};
      expect(Object.keys(stepResults).length).toBe(3);

      console.log(`\n✅ All ${Object.keys(stepResults).length} steps completed\n`);
    }, 15000);

    it('should execute parallel tasks in approximately 4 seconds (not 9 seconds)', async () => {
      console.log('\n🧪 TEST: Parallel Execution Timing Validation\n');

      const executor = new PipelineExecutor(parallelExecutionPipeline);

      // Track when parallel execution starts and ends
      const result = await executor.execute({ metadata: {} });

      expect(result.success).toBe(true);

      const aggregatedResult = result.stepResults?.['result-aggregator'] as StepResult<AggregatedResults>;
      expect(aggregatedResult?.success).toBe(true);
      expect(aggregatedResult?.data).toBeDefined();

      const aggregated = aggregatedResult.data!;

      // Parallel tasks: 3s, 4s, 2s -> should take ~4s (max), not 9s (sum)
      // Allow 1 second tolerance for overhead
      expect(aggregated.totalParallelTime).toBeGreaterThanOrEqual(4000); // At least 4 seconds (longest task)
      expect(aggregated.totalParallelTime).toBeLessThan(5000); // Less than 5 seconds (4s + 1s tolerance)

      // Verify it's significantly faster than sequential execution
      expect(aggregated.totalParallelTime).toBeLessThan(aggregated.expectedSequentialTime / 2);

      console.log(`  ✅ Parallel Duration: ${aggregated.totalParallelTime}ms`);
      console.log(`  ✅ Sequential Duration: ${aggregated.expectedSequentialTime}ms`);
      console.log(`  ✅ Time Improvement: ${aggregated.timeImprovement.toFixed(1)}%`);
    }, 15000);

    it('should aggregate results from all 3 parallel tasks', async () => {
      console.log('\n🧪 TEST: Result Aggregation\n');

      const executor = new PipelineExecutor(parallelExecutionPipeline);
      const result = await executor.execute({ metadata: {} });

      expect(result.success).toBe(true);

      const aggregatedResult = result.stepResults?.['result-aggregator'] as StepResult<AggregatedResults>;
      expect(aggregatedResult?.success).toBe(true);

      const aggregated = aggregatedResult.data!;

      // Verify all 3 parallel tasks are present
      expect(aggregated.parallelTasks).toBeDefined();
      expect(aggregated.parallelTasks.length).toBe(3);

      // Verify task names
      const taskNames = aggregated.parallelTasks.map(task => task.taskName).sort();
      expect(taskNames).toEqual([
        'parallel-task-alpha',
        'parallel-task-beta',
        'parallel-task-gamma',
      ]);

      // Verify all tasks succeeded
      expect(aggregated.allTasksSucceeded).toBe(true);

      // Verify each task has expected duration
      const alphaDuration = aggregated.parallelTasks.find(t => t.taskName === 'parallel-task-alpha')?.duration;
      const betaDuration = aggregated.parallelTasks.find(t => t.taskName === 'parallel-task-beta')?.duration;
      const gammaDuration = aggregated.parallelTasks.find(t => t.taskName === 'parallel-task-gamma')?.duration;

      expect(alphaDuration).toBeGreaterThanOrEqual(3000); // ~3 seconds
      expect(alphaDuration).toBeLessThan(3200);

      expect(betaDuration).toBeGreaterThanOrEqual(4000); // ~4 seconds
      expect(betaDuration).toBeLessThan(4200);

      expect(gammaDuration).toBeGreaterThanOrEqual(2000); // ~2 seconds
      expect(gammaDuration).toBeLessThan(2200);

      console.log(`  ✅ Alpha: ${alphaDuration}ms (expected: ~3000ms)`);
      console.log(`  ✅ Beta: ${betaDuration}ms (expected: ~4000ms)`);
      console.log(`  ✅ Gamma: ${gammaDuration}ms (expected: ~2000ms)`);
    }, 15000);

    it('should include prerequisite data in aggregated results', async () => {
      console.log('\n🧪 TEST: Prerequisite Integration\n');

      const executor = new PipelineExecutor(parallelExecutionPipeline);
      const result = await executor.execute({ metadata: {} });

      expect(result.success).toBe(true);

      const aggregatedResult = result.stepResults?.['result-aggregator'] as StepResult<AggregatedResults>;
      const aggregated = aggregatedResult.data!;

      // Verify prerequisite data is included
      expect(aggregated.prerequisite).toBeDefined();
      expect(aggregated.prerequisite.processingTime).toBeGreaterThanOrEqual(1000);
      expect(aggregated.prerequisite.processingTime).toBeLessThan(1200);

      console.log(`  ✅ Prerequisite completed in ${aggregated.prerequisite.processingTime}ms`);
    }, 15000);
  });

  describe('Failure Scenario', () => {
    it('should fail pipeline if one parallel task fails', async () => {
      console.log('\n🧪 TEST: Parallel Task Failure Handling\n');

      // Create a custom pipeline where one parallel task fails
      const failingPipeline = definePipeline({
        name: 'parallel-execution-failure-test',
        description: 'Test parallel execution with one failing task',
        steps: [
          step(
            'parallel-task-executor-with-failure',
            async (_ctx: StepContext): Promise<StepResult<ParallelTaskResult[]>> => {
              try {
                // Execute parallel tasks, one of which will fail
                const parallelTasks = [
                  Promise.resolve({
                    taskName: 'task-alpha',
                    duration: 1000,
                    completedAt: new Date(),
                    data: { message: 'Success' },
                  }),
                  Promise.reject(new Error('Task beta intentionally failed')),
                  Promise.resolve({
                    taskName: 'task-gamma',
                    duration: 1000,
                    completedAt: new Date(),
                    data: { message: 'Success' },
                  }),
                ];

                const results = await Promise.all(parallelTasks);

                return {
                  success: true,
                  data: results,
                };
              } catch (error: any) {
                console.log(`  ✅ Caught parallel task failure: ${error.message}`);
                return {
                  success: false,
                  error: `Parallel execution failed: ${error.message}`,
                };
              }
            }
          ),
          step(
            'result-aggregator',
            async (ctx: StepContext): Promise<StepResult<any>> => {
              // This should not run because parallel executor failed
              const parallelResults = ctx.prevResults['parallel-task-executor-with-failure'] as StepResult<ParallelTaskResult[]>;

              if (!parallelResults?.success) {
                throw new Error('Cannot aggregate - parallel tasks failed');
              }

              return {
                success: true,
                data: { message: 'Should not reach here' },
              };
            }
          ),
        ],
      });

      const executor = new PipelineExecutor(failingPipeline);
      const result = await executor.execute({ metadata: {} });

      // Pipeline should fail
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('failed');

      // Aggregator should not have run
      const aggregatorResult = result.stepResults?.['result-aggregator'];
      expect(aggregatorResult).toBeUndefined();

      console.log(`  ✅ Pipeline correctly failed: ${result.error}`);
    }, 10000);
  });

  describe('Performance Characteristics', () => {
    it('should demonstrate significant time savings with parallel execution', async () => {
      console.log('\n🧪 TEST: Time Savings Validation\n');

      const executor = new PipelineExecutor(parallelExecutionPipeline);
      const result = await executor.execute({ metadata: {} });

      const aggregatedResult = result.stepResults?.['result-aggregator'] as StepResult<AggregatedResults>;
      const aggregated = aggregatedResult.data!;

      // Parallel execution should save at least 50% of time compared to sequential
      expect(aggregated.timeImprovement).toBeGreaterThan(50);

      // Verify it actually ran in parallel (max time, not sum)
      const sumOfDurations = aggregated.parallelTasks.reduce((sum, task) => sum + task.duration, 0);
      const parallelDuration = aggregated.totalParallelTime;

      // Parallel duration should be much less than sum
      expect(parallelDuration).toBeLessThan(sumOfDurations * 0.6); // At most 60% of sequential time

      console.log(`  ✅ Time Improvement: ${aggregated.timeImprovement.toFixed(1)}%`);
      console.log(`  ✅ Parallel: ${parallelDuration}ms vs Sequential: ${sumOfDurations}ms`);
    }, 15000);
  });
});
