/**
 * Retry Logic Demo Pipeline
 *
 * Demonstrates and tests the framework's retry mechanisms including:
 * - Exponential backoff with configurable retry attempts
 * - Eventual success after multiple failures
 * - Permanent failure after exhausting retries
 * - Retry metrics tracking and analysis
 *
 * This pipeline showcases:
 * - Flaky services that succeed after N failures
 * - Configurable maxRetries per step
 * - Automatic retry with exponential backoff
 * - Retry attempt tracking and validation
 */

import { definePipeline, step } from '../core/index.js';
import { mockFlakyService } from '../services/mock-flaky-service.js';
import type { StepContext, StepResult } from '../core/types.js';
import type { MockFlakyServiceData } from '../services/mock-flaky-service.js';

/**
 * Retry metrics summary data structure
 */
export interface RetryMetrics {
  stepName: string;
  expectedAttempts: number;
  actualAttempts: number;
  succeeded: boolean;
  matchesExpectation: boolean;
}

export interface RetryMetricsSummary {
  steps: RetryMetrics[];
  allStepsValid: boolean;
  totalRetries: number;
}

export default definePipeline({
  name: 'retry-logic-demo',
  description: 'Demonstrates retry behaviors including exponential backoff, eventual success, and permanent failure',

  steps: [
    // Step 1: Flaky Service Alpha - Fails 2 times, succeeds on attempt 3
    step(
      'flaky-service-alpha',
      async (ctx: StepContext): Promise<StepResult<MockFlakyServiceData>> => {
        console.log('\n🔄 Step 1: Flaky Service Alpha (fails 2 times before success)');
        console.log('═'.repeat(50));

        // Ensure metadata exists and add service-specific config
        if (!ctx.metadata) {
          ctx.metadata = {};
        }
        ctx.metadata.serviceName = 'alpha';
        ctx.metadata.config = {
          failuresBeforeSuccess: 2, // Will fail on attempts 1 and 2, succeed on attempt 3
        };

        return await mockFlakyService(ctx);
      },
      {
        maxRetries: 3, // Allow up to 3 retries (4 total attempts including initial)
      }
    ),

    // Step 2: Flaky Service Beta - Fails 1 time, succeeds on attempt 2
    step(
      'flaky-service-beta',
      async (ctx: StepContext): Promise<StepResult<MockFlakyServiceData>> => {
        console.log('\n🔄 Step 2: Flaky Service Beta (fails 1 time before success)');
        console.log('═'.repeat(50));

        // Ensure metadata exists and add service-specific config
        if (!ctx.metadata) {
          ctx.metadata = {};
        }
        ctx.metadata.serviceName = 'beta';
        ctx.metadata.config = {
          failuresBeforeSuccess: 1, // Will fail on attempt 1, succeed on attempt 2
        };

        return await mockFlakyService(ctx);
      },
      {
        maxRetries: 2, // Allow up to 2 retries (3 total attempts including initial)
      }
    ),

    // Step 3: Permanent Failure Service - Always fails (99 failures required)
    step(
      'permanent-failure-service',
      async (ctx: StepContext): Promise<StepResult<MockFlakyServiceData>> => {
        console.log('\n❌ Step 3: Permanent Failure Service (always fails)');
        console.log('═'.repeat(50));

        // Ensure metadata exists and add service-specific config
        if (!ctx.metadata) {
          ctx.metadata = {};
        }
        ctx.metadata.serviceName = 'gamma';
        ctx.metadata.config = {
          failuresBeforeSuccess: 99, // Will never succeed within retry limit
        };

        return await mockFlakyService(ctx);
      },
      {
        maxRetries: 2, // Allow up to 2 retries (3 total attempts including initial)
      }
    ),

    // Step 4: Retry Metrics Analyzer - Validates retry behavior
    step(
      'retry-metrics-analyzer',
      async (ctx: StepContext): Promise<StepResult<RetryMetricsSummary>> => {
        console.log('\n📊 Step 4: Retry Metrics Analyzer');
        console.log('═'.repeat(50));

        try {
          const alphaResult = ctx.prevResults['flaky-service-alpha'] as StepResult<MockFlakyServiceData>;
          const betaResult = ctx.prevResults['flaky-service-beta'] as StepResult<MockFlakyServiceData>;
          const gammaResult = ctx.prevResults['permanent-failure-service'] as StepResult<MockFlakyServiceData>;

          const steps: RetryMetrics[] = [];

          // Analyze alpha service (should succeed on attempt 3)
          if (alphaResult?.data) {
            const alphaMetrics: RetryMetrics = {
              stepName: 'flaky-service-alpha',
              expectedAttempts: 3,
              actualAttempts: alphaResult.data.totalAttempts,
              succeeded: alphaResult.success,
              matchesExpectation: alphaResult.success && alphaResult.data.totalAttempts === 3,
            };
            steps.push(alphaMetrics);
            console.log(
              `  ${alphaMetrics.matchesExpectation ? '✅' : '❌'} Alpha: ${alphaMetrics.actualAttempts} attempts (expected 3), ${alphaMetrics.succeeded ? 'succeeded' : 'failed'}`
            );
          }

          // Analyze beta service (should succeed on attempt 2)
          if (betaResult?.data) {
            const betaMetrics: RetryMetrics = {
              stepName: 'flaky-service-beta',
              expectedAttempts: 2,
              actualAttempts: betaResult.data.totalAttempts,
              succeeded: betaResult.success,
              matchesExpectation: betaResult.success && betaResult.data.totalAttempts === 2,
            };
            steps.push(betaMetrics);
            console.log(
              `  ${betaMetrics.matchesExpectation ? '✅' : '❌'} Beta: ${betaMetrics.actualAttempts} attempts (expected 2), ${betaMetrics.succeeded ? 'succeeded' : 'failed'}`
            );
          }

          // Analyze gamma service (should fail after 3 attempts)
          if (gammaResult) {
            const gammaAttempts = gammaResult.data?.totalAttempts || 0;
            const gammaMetrics: RetryMetrics = {
              stepName: 'permanent-failure-service',
              expectedAttempts: 3,
              actualAttempts: gammaAttempts,
              succeeded: gammaResult.success,
              matchesExpectation: !gammaResult.success && gammaAttempts === 3,
            };
            steps.push(gammaMetrics);
            console.log(
              `  ${gammaMetrics.matchesExpectation ? '✅' : '❌'} Gamma: ${gammaMetrics.actualAttempts} attempts (expected 3), ${gammaMetrics.succeeded ? 'succeeded' : 'failed'}`
            );
          }

          const allStepsValid = steps.every(step => step.matchesExpectation);
          const totalRetries = steps.reduce((sum, step) => sum + (step.actualAttempts - 1), 0);

          console.log(`\n  📈 Retry Summary:`);
          console.log(`     Total Retries: ${totalRetries}`);
          console.log(`     All Expectations Met: ${allStepsValid ? 'Yes ✅' : 'No ❌'}`);

          const summary: RetryMetricsSummary = {
            steps,
            allStepsValid,
            totalRetries,
          };

          return {
            success: true,
            data: summary,
          };
        } catch (error: any) {
          console.error(`  ❌ Retry Metrics Analyzer error:`, error.message);
          return {
            success: false,
            error: `Retry metrics analysis failed: ${error.message}`,
          };
        }
      }
    ),
  ],
});
