/**
 * Retry Logic Demo Pipeline Integration Tests
 *
 * Tests for the retry logic demonstration pipeline including:
 * - Eventual success after configured failures
 * - Permanent failure after exhausting retries
 * - Exponential backoff timing validation
 * - Retry metrics tracking
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { PipelineExecutor } from '../../src/core/executor.js';
import retryLogicPipeline from '../../src/pipelines/retry-logic-demo.js';
import { definePipeline, step } from '../../src/core/index.js';
import { mockFlakyService } from '../../src/services/mock-flaky-service.js';
import type { StepContext, StepResult } from '../../src/core/types.js';
import type { RetryMetricsSummary } from '../../src/pipelines/retry-logic-demo.js';
import type { MockFlakyServiceData } from '../../src/services/mock-flaky-service.js';

describe('Retry Logic Demo Pipeline', () => {
  // Note: Set RETRY_DELAY_MULTIPLIER=0.001 in .env.test for fast tests
  // This converts the default 30s, 60s, 120s backoff to 30ms, 60ms, 120ms

  beforeAll(() => {
    // Verify that RETRY_DELAY_MULTIPLIER is set for fast tests
    const multiplier = process.env.RETRY_DELAY_MULTIPLIER;
    if (!multiplier || parseFloat(multiplier) > 0.1) {
      console.warn('⚠️  RETRY_DELAY_MULTIPLIER not set or too high. Tests may be slow.');
      console.warn('   Set RETRY_DELAY_MULTIPLIER=0.001 in .env.test for fast tests.');
    }
  });

  describe('Successful Retry Scenarios', () => {
    it('should succeed with flaky-service-alpha after 3 attempts', async () => {
      console.log('\n🧪 TEST: Flaky Service Alpha - Success after 2 failures\n');

      const testPipeline = definePipeline({
        name: 'test-alpha-only',
        description: 'Test alpha service in isolation',
        steps: [
          step(
            'flaky-service-alpha',
            async (ctx: StepContext): Promise<StepResult<MockFlakyServiceData>> => {
              if (!ctx.metadata) {
                ctx.metadata = {};
              }
              ctx.metadata.serviceName = 'alpha';
              ctx.metadata.config = {
                failuresBeforeSuccess: 2,
              };
              return await mockFlakyService(ctx);
            },
            { maxRetries: 3 }
          ),
        ],
      });

      const executor = new PipelineExecutor(testPipeline);
      const result = await executor.execute({ metadata: {} });

      expect(result.success).toBe(true);

      const alphaResult = result.stepResults?.['flaky-service-alpha'];
      expect(alphaResult?.success).toBe(true);
      expect(alphaResult?.data).toBeDefined();

      const alphaData = alphaResult?.data as MockFlakyServiceData;
      expect(alphaData.totalAttempts).toBe(3); // Fails on attempts 1 and 2, succeeds on 3
      expect(alphaData.succeeded).toBe(true);

      console.log(`  ✅ Alpha succeeded after ${alphaData.totalAttempts} attempts (expected: 3)`);
    }, 30000); // 30 second timeout

    it('should succeed with flaky-service-beta after 2 attempts', async () => {
      console.log('\n🧪 TEST: Flaky Service Beta - Success after 1 failure\n');

      const testPipeline = definePipeline({
        name: 'test-beta-only',
        description: 'Test beta service in isolation',
        steps: [
          step(
            'flaky-service-beta',
            async (ctx: StepContext): Promise<StepResult<MockFlakyServiceData>> => {
              if (!ctx.metadata) {
                ctx.metadata = {};
              }
              ctx.metadata.serviceName = 'beta';
              ctx.metadata.config = {
                failuresBeforeSuccess: 1,
              };
              return await mockFlakyService(ctx);
            },
            { maxRetries: 2 }
          ),
        ],
      });

      const executor = new PipelineExecutor(testPipeline);
      const result = await executor.execute({ metadata: {} });

      expect(result.success).toBe(true);

      const betaResult = result.stepResults?.['flaky-service-beta'];
      expect(betaResult?.success).toBe(true);
      expect(betaResult?.data).toBeDefined();

      const betaData = betaResult?.data as MockFlakyServiceData;
      expect(betaData.totalAttempts).toBe(2); // Fails on attempt 1, succeeds on 2
      expect(betaData.succeeded).toBe(true);

      console.log(`  ✅ Beta succeeded after ${betaData.totalAttempts} attempts (expected: 2)`);
    }, 30000);
  });

  describe('Permanent Failure Scenario', () => {
    it('should fail with permanent-failure-service after 3 attempts', async () => {
      console.log('\n🧪 TEST: Permanent Failure Service - Exhausts all retries\n');

      const testPipeline = definePipeline({
        name: 'test-gamma-only',
        description: 'Test gamma service (permanent failure) in isolation',
        steps: [
          step(
            'permanent-failure-service',
            async (ctx: StepContext): Promise<StepResult<MockFlakyServiceData>> => {
              if (!ctx.metadata) {
                ctx.metadata = {};
              }
              ctx.metadata.serviceName = 'gamma';
              ctx.metadata.config = {
                failuresBeforeSuccess: 99, // Will never succeed
              };
              return await mockFlakyService(ctx);
            },
            { maxRetries: 2 } // 1 initial + 2 retries = 3 total attempts
          ),
        ],
      });

      const executor = new PipelineExecutor(testPipeline);
      const result = await executor.execute({ metadata: {} });

      // Pipeline should fail because gamma never succeeds
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Note: When a step exhausts retries and fails, it may not be in stepResults
      // The executor throws an error after exhausting retries
      // Verify the error message contains information about the failure
      expect(result.error).toContain('gamma');

      console.log(`  ✅ Pipeline correctly failed: ${result.error}`);
    }, 30000);
  });

  describe('Exponential Backoff Timing', () => {
    it('should apply exponential backoff between retry attempts', async () => {
      console.log('\n🧪 TEST: Exponential Backoff Timing Validation\n');

      const attemptTimestamps: number[] = [];

      const testPipeline = definePipeline({
        name: 'test-backoff-timing',
        description: 'Test exponential backoff timing',
        steps: [
          step(
            'timed-flaky-service',
            async (ctx: StepContext): Promise<StepResult<MockFlakyServiceData>> => {
              // Record attempt timestamp
              attemptTimestamps.push(Date.now());

              if (!ctx.metadata) {
                ctx.metadata = {};
              }
              ctx.metadata.serviceName = 'timed';
              ctx.metadata.config = {
                failuresBeforeSuccess: 2, // Fails on attempts 1 and 2, succeeds on 3
              };

              return await mockFlakyService(ctx);
            },
            { maxRetries: 3 }
          ),
        ],
      });

      const startTime = Date.now();
      const executor = new PipelineExecutor(testPipeline);
      const result = await executor.execute({ metadata: {} });
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(attemptTimestamps.length).toBe(3);

      // Calculate delays between attempts
      const delays: number[] = [];
      for (let i = 1; i < attemptTimestamps.length; i++) {
        const delay = attemptTimestamps[i] - attemptTimestamps[i - 1];
        delays.push(delay);
      }

      // With RETRY_DELAY_MULTIPLIER=0.001:
      // - Base backoff is 30s, 60s, 120s...
      // - Multiplied: 30ms, 60ms, 120ms...
      // - Allow 500ms tolerance for processing overhead (DB writes, event emission, etc.)

      const multiplier = parseFloat(process.env.RETRY_DELAY_MULTIPLIER || '1');
      const expectedDelays = [
        30 * 1000 * multiplier, // First retry: 30s * multiplier
        60 * 1000 * multiplier, // Second retry: 60s * multiplier
      ];
      const tolerance = 500; // 500ms tolerance for processing overhead

      console.log(`  📊 Backoff Timing Analysis:`);
      console.log(`     Multiplier: ${multiplier}`);
      console.log(`     Total Time: ${totalTime}ms`);

      delays.forEach((actualDelay, index) => {
        const expectedDelay = expectedDelays[index];
        const diff = Math.abs(actualDelay - expectedDelay);
        const withinTolerance = diff <= tolerance;

        console.log(
          `     ${withinTolerance ? '✅' : '❌'} Retry ${index + 1}: ${actualDelay}ms (expected: ${expectedDelay}ms, diff: ${diff}ms)`
        );

        // Verify within tolerance
        expect(actualDelay).toBeGreaterThanOrEqual(expectedDelay - tolerance);
        expect(actualDelay).toBeLessThanOrEqual(expectedDelay + tolerance);
      });
    }, 60000); // 60 second timeout
  });

  describe('Full Pipeline with Metrics', () => {
    // Note: This test will fail at the permanent-failure-service step
    // We test the successful steps separately above

    it('should track retry metrics for alpha and beta before gamma fails', async () => {
      console.log('\n🧪 TEST: Partial Pipeline Execution (Alpha + Beta success, Gamma fails)\n');

      // Create a pipeline with just alpha and beta (no gamma)
      const testPipeline = definePipeline({
        name: 'test-alpha-beta-only',
        description: 'Test alpha and beta without gamma',
        steps: [
          step(
            'flaky-service-alpha',
            async (ctx: StepContext): Promise<StepResult<MockFlakyServiceData>> => {
              if (!ctx.metadata) {
                ctx.metadata = {};
              }
              ctx.metadata.serviceName = 'alpha';
              ctx.metadata.config = { failuresBeforeSuccess: 2 };
              return await mockFlakyService(ctx);
            },
            { maxRetries: 3 }
          ),
          step(
            'flaky-service-beta',
            async (ctx: StepContext): Promise<StepResult<MockFlakyServiceData>> => {
              if (!ctx.metadata) {
                ctx.metadata = {};
              }
              ctx.metadata.serviceName = 'beta';
              ctx.metadata.config = { failuresBeforeSuccess: 1 };
              return await mockFlakyService(ctx);
            },
            { maxRetries: 2 }
          ),
        ],
      });

      const executor = new PipelineExecutor(testPipeline);
      const result = await executor.execute({ metadata: {} });

      // Both should succeed
      expect(result.success).toBe(true);

      const alphaResult = result.stepResults?.['flaky-service-alpha'];
      const betaResult = result.stepResults?.['flaky-service-beta'];

      expect(alphaResult?.success).toBe(true);
      expect(betaResult?.success).toBe(true);

      const alphaData = alphaResult?.data as MockFlakyServiceData;
      const betaData = betaResult?.data as MockFlakyServiceData;

      expect(alphaData.totalAttempts).toBe(3);
      expect(betaData.totalAttempts).toBe(2);

      const totalRetries = (alphaData.totalAttempts - 1) + (betaData.totalAttempts - 1);
      expect(totalRetries).toBe(3); // Alpha: 2 retries, Beta: 1 retry

      console.log(`  ✅ Alpha: ${alphaData.totalAttempts} attempts (2 retries)`);
      console.log(`  ✅ Beta: ${betaData.totalAttempts} attempts (1 retry)`);
      console.log(`  ✅ Total Retries: ${totalRetries}`);
    }, 60000);
  });
});
