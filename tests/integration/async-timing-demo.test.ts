/**
 * Async & Timing Demo Pipeline Integration Tests
 *
 * Tests for the async timing demonstration pipeline including:
 * - Sequential execution with varying delays
 * - Timeout enforcement and error handling
 * - Timing accuracy validation
 * - Retry-on-timeout mechanism
 */

import { describe, it, expect } from '@jest/globals';
import { PipelineExecutor } from '../../src/core/executor.js';
import asyncTimingPipeline from '../../src/pipelines/async-timing-demo.js';
import { definePipeline, step } from '../../src/core/index.js';
import { mockSlowAPI } from '../../src/services/mock-slow-api.js';
import type { StepContext, StepResult } from '../../src/core/types.js';
import type { TimingSummary } from '../../src/pipelines/async-timing-demo.js';
import type { MockSlowAPIData } from '../../src/services/mock-slow-api.js';

describe('Async & Timing Demo Pipeline', () => {
  describe('Success Path', () => {
    it('should complete all 5 steps successfully', async () => {
      console.log('\n🧪 TEST: Async Timing Demo - Full pipeline execution\n');

      const executor = new PipelineExecutor(asyncTimingPipeline);

      const result = await executor.execute({
        metadata: {},
      });

      // Verify pipeline completed successfully
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify all 5 steps completed
      const stepResults = result.stepResults || {};
      expect(Object.keys(stepResults).length).toBe(5);

      console.log(`\n✅ All ${Object.keys(stepResults).length} steps completed\n`);
    }, 15000); // 15 second timeout

    it('should have total duration of approximately 10-13 seconds', async () => {
      console.log('\n🧪 TEST: Total Pipeline Duration\n');

      const startTime = Date.now();
      const executor = new PipelineExecutor(asyncTimingPipeline);
      const result = await executor.execute({ metadata: {} });
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);

      // Verify total duration is approximately 10-13 seconds
      // Expected: 5000 + 2000 + ~0 + 3000 = 10000ms
      // Allow 3 second buffer for overhead (database operations, event processing)
      expect(totalTime).toBeGreaterThanOrEqual(10000); // At least 10 seconds
      expect(totalTime).toBeLessThan(13000); // Less than 13 seconds

      console.log(`  ✅ Total pipeline duration: ${totalTime}ms (expected: 10000-13000ms)`);
    }, 15000);

    it('should execute slow-step with 5000ms delay', async () => {
      console.log('\n🧪 TEST: Slow Step Timing\n');

      const executor = new PipelineExecutor(asyncTimingPipeline);
      const result = await executor.execute({ metadata: {} });

      const slowStep = result.stepResults?.['slow-step'];
      expect(slowStep?.success).toBe(true);

      const slowData = slowStep?.data as MockSlowAPIData;
      expect(slowData).toBeDefined();
      expect(slowData.processingTime).toBeGreaterThanOrEqual(5000);
      expect(slowData.processingTime).toBeLessThan(5200); // 200ms tolerance

      console.log(`  ✅ Slow step completed in ${slowData.processingTime}ms (expected: ~5000ms)`);
    }, 15000);

    it('should execute medium-step with 2000ms delay', async () => {
      console.log('\n🧪 TEST: Medium Step Timing\n');

      const executor = new PipelineExecutor(asyncTimingPipeline);
      const result = await executor.execute({ metadata: {} });

      const mediumStep = result.stepResults?.['medium-step'];
      expect(mediumStep?.success).toBe(true);

      const mediumData = mediumStep?.data as MockSlowAPIData;
      expect(mediumData).toBeDefined();
      expect(mediumData.processingTime).toBeGreaterThanOrEqual(2000);
      expect(mediumData.processingTime).toBeLessThan(2200); // 200ms tolerance

      console.log(`  ✅ Medium step completed in ${mediumData.processingTime}ms (expected: ~2000ms)`);
    }, 15000);

    it('should execute instant-step with near-zero delay', async () => {
      console.log('\n🧪 TEST: Instant Step Timing\n');

      const executor = new PipelineExecutor(asyncTimingPipeline);
      const result = await executor.execute({ metadata: {} });

      const instantStep = result.stepResults?.['instant-step'];
      expect(instantStep?.success).toBe(true);

      const instantData = instantStep?.data as { completedAt: Date; processingTime: number };
      expect(instantData).toBeDefined();
      expect(instantData.processingTime).toBeLessThan(50); // Should be very fast

      console.log(`  ✅ Instant step completed in ${instantData.processingTime}ms (expected: <50ms)`);
    }, 15000);

    it('should execute timeout-test with 3000ms delay', async () => {
      console.log('\n🧪 TEST: Timeout Test Step Timing\n');

      const executor = new PipelineExecutor(asyncTimingPipeline);
      const result = await executor.execute({ metadata: {} });

      const timeoutStep = result.stepResults?.['timeout-test'];
      expect(timeoutStep?.success).toBe(true);

      const timeoutData = timeoutStep?.data as MockSlowAPIData;
      expect(timeoutData).toBeDefined();
      expect(timeoutData.processingTime).toBeGreaterThanOrEqual(3000);
      expect(timeoutData.processingTime).toBeLessThan(3200); // 200ms tolerance

      console.log(`  ✅ Timeout test step completed in ${timeoutData.processingTime}ms (expected: ~3000ms)`);
    }, 15000);

    it('should validate all timings in timing-summary step', async () => {
      console.log('\n🧪 TEST: Timing Summary Validation\n');

      const executor = new PipelineExecutor(asyncTimingPipeline);
      const result = await executor.execute({ metadata: {} });

      const summaryStep = result.stepResults?.['timing-summary'];
      expect(summaryStep?.success).toBe(true);

      const summary = summaryStep?.data as TimingSummary;
      expect(summary).toBeDefined();
      expect(summary.allStepsValid).toBe(true);
      expect(summary.stepTimings.length).toBe(4);

      // Verify each step timing is within tolerance
      summary.stepTimings.forEach(timing => {
        expect(timing.withinTolerance).toBe(true);
        console.log(`  ✅ ${timing.name}: ${timing.actualDelay}ms (expected: ${timing.expectedDelay}ms)`);
      });

      console.log(`  ✅ Total Duration: ${summary.totalDuration}ms`);
      console.log(`  ✅ Efficiency: ${summary.performanceMetrics.efficiency.toFixed(2)}%`);
    }, 15000);
  });

  describe('Timeout Enforcement', () => {
    it('should timeout when timeout-test step has 2000ms timeout with 3000ms delay', async () => {
      console.log('\n🧪 TEST: Timeout Enforcement\n');

      // Create a custom pipeline with timeout configuration
      const timeoutPipeline = definePipeline({
        name: 'async-timing-demo-timeout-test',
        description: 'Tests timeout enforcement on the timeout-test step',
        steps: [
          // Only include the timeout-test step with a 2000ms timeout
          step(
            'timeout-test',
            async (ctx: StepContext): Promise<StepResult<MockSlowAPIData>> => {
              return await mockSlowAPI({
                ...ctx,
                metadata: {
                  config: {
                    delay: 3000, // 3000ms delay
                    shouldFail: false,
                  },
                },
              });
            },
            {
              timeout: 2000, // 2000ms timeout - should timeout!
            }
          ),
        ],
      });

      const executor = new PipelineExecutor(timeoutPipeline);
      const result = await executor.execute({ metadata: {} });

      // Pipeline should fail due to timeout
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('timeout');

      console.log(`  ✅ Timeout correctly enforced: ${result.error}`);
    }, 10000);

    it('should succeed when timeout-test step has 4000ms timeout with 3000ms delay', async () => {
      console.log('\n🧪 TEST: Timeout Success\n');

      // Create a custom pipeline with sufficient timeout
      const timeoutPipeline = definePipeline({
        name: 'async-timing-demo-timeout-success',
        description: 'Tests successful execution within timeout',
        steps: [
          step(
            'timeout-test',
            async (ctx: StepContext): Promise<StepResult<MockSlowAPIData>> => {
              return await mockSlowAPI({
                ...ctx,
                metadata: {
                  config: {
                    delay: 3000, // 3000ms delay
                    shouldFail: false,
                  },
                },
              });
            },
            {
              timeout: 4000, // 4000ms timeout - should succeed!
            }
          ),
        ],
      });

      const executor = new PipelineExecutor(timeoutPipeline);
      const result = await executor.execute({ metadata: {} });

      // Pipeline should succeed
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      const timeoutStep = result.stepResults?.['timeout-test'];
      expect(timeoutStep?.success).toBe(true);

      const timeoutData = timeoutStep?.data as MockSlowAPIData;
      expect(timeoutData.processingTime).toBeGreaterThanOrEqual(3000);

      console.log(`  ✅ Step completed within timeout: ${timeoutData.processingTime}ms`);
    }, 10000);
  });

  describe('Retry on Timeout', () => {
    it('should retry and succeed after timeout with maxRetries', async () => {
      console.log('\n🧪 TEST: Retry on Timeout\n');

      let attemptCount = 0;

      // Create a custom pipeline with retry configuration
      const retryPipeline = definePipeline({
        name: 'async-timing-demo-retry-test',
        description: 'Tests retry mechanism on timeout',
        steps: [
          step(
            'flaky-timeout-step',
            async (ctx: StepContext): Promise<StepResult<{ attempt: number; processingTime: number }>> => {
              attemptCount++;
              const startTime = Date.now();

              console.log(`  🔄 Attempt ${attemptCount}`);

              // First attempt: delay exceeds timeout
              // Second attempt: succeeds within timeout
              const delay = attemptCount === 1 ? 2500 : 500;

              await new Promise(resolve => setTimeout(resolve, delay));

              const processingTime = Date.now() - startTime;

              return {
                success: true,
                data: {
                  attempt: attemptCount,
                  processingTime,
                },
              };
            },
            {
              timeout: 2000, // 2000ms timeout
              maxRetries: 2, // Allow up to 2 retries
            }
          ),
        ],
      });

      const executor = new PipelineExecutor(retryPipeline);
      const result = await executor.execute({ metadata: {} });

      // Should succeed after retry
      expect(result.success).toBe(true);
      expect(attemptCount).toBeGreaterThan(1); // Should have retried at least once

      const stepResult = result.stepResults?.['flaky-timeout-step'];
      expect(stepResult?.success).toBe(true);

      console.log(`  ✅ Succeeded after ${attemptCount} attempts`);
    }, 15000);

    it('should fail after exhausting all retries', async () => {
      console.log('\n🧪 TEST: Retry Exhaustion\n');

      let attemptCount = 0;

      // Create a custom pipeline that always times out
      const retryPipeline = definePipeline({
        name: 'async-timing-demo-retry-exhaustion',
        description: 'Tests retry exhaustion',
        steps: [
          step(
            'always-timeout-step',
            async (ctx: StepContext): Promise<StepResult<{ attempt: number }>> => {
              attemptCount++;
              console.log(`  🔄 Attempt ${attemptCount}`);

              // Always delay longer than timeout
              await new Promise(resolve => setTimeout(resolve, 2500));

              return {
                success: true,
                data: { attempt: attemptCount },
              };
            },
            {
              timeout: 2000, // 2000ms timeout
              maxRetries: 2, // Allow up to 2 retries (total 3 attempts)
            }
          ),
        ],
      });

      const executor = new PipelineExecutor(retryPipeline);
      const result = await executor.execute({ metadata: {} });

      // Should fail after exhausting retries
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(attemptCount).toBe(3); // Initial attempt + 2 retries

      console.log(`  ✅ Failed after ${attemptCount} attempts (expected)`);
      console.log(`  ✅ Error: ${result.error}`);
    }, 15000);
  });
});
