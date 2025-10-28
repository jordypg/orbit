/**
 * Connection Pool Demo Pipeline
 *
 * Demonstrates and tests the framework's handling of:
 * - Resource management with limited connection pools
 * - Concurrent operations competing for shared resources
 * - Connection pool queuing and wait times
 * - Pool metrics and performance monitoring
 *
 * This pipeline showcases:
 * - Initialization of a shared connection pool (max 3 connections)
 * - 5 parallel steps competing for 3 connections
 * - FIFO queuing when pool is exhausted
 * - Wait time analysis and validation
 * - Pool metrics reporting
 */

import { definePipeline, step } from '../core/index.js';
import {
  MockConnectionPool,
  mockDatabaseService,
  type MockDatabaseData
} from '../services/mock-database.js';
import type { StepContext, StepResult } from '../core/types.js';

/**
 * Pool metrics summary data structure
 */
export interface PoolMetricsSummary {
  totalQueries: number;
  peakActiveConnections: number;
  maxQueueLength: number;
  averageWaitTime: number;
  queryTimings: {
    queryId: string;
    connectionId: string;
    executionTime: number;
    waitTime: number;
  }[];
  poolConfiguration: {
    maxConnections: number;
    queryDelay: number;
  };
  validationResults: {
    peakUsageValid: boolean;
    waitTimesValid: boolean;
    executionTimeValid: boolean;
  };
}

export default definePipeline({
  name: 'connection-pool-demo',
  description: 'Demonstrates resource management with a limited connection pool',

  steps: [
    // Step 1: Initialize Connection Pool
    step(
      'init-pool',
      async (ctx: StepContext): Promise<StepResult<{ maxConnections: number }>> => {
        console.log('\n🏊 Step 1: Initialize Connection Pool');
        console.log('═'.repeat(50));

        try {
          // Create a connection pool with max 3 connections
          const pool = new MockConnectionPool(3);

          // Store pool in context for other steps to use
          if (!ctx.metadata) {
            ctx.metadata = {};
          }
          ctx.metadata.connectionPool = pool;

          const maxConnections = pool.getMaxConnections();
          console.log(`  ✅ Connection pool initialized with ${maxConnections} connections`);

          return {
            success: true,
            data: { maxConnections },
          };
        } catch (error: any) {
          console.error(`  ❌ Pool initialization error:`, error.message);
          return {
            success: false,
            error: `Pool initialization failed: ${error.message}`,
          };
        }
      }
    ),

    // Step 2: Execute 5 Parallel Database Queries
    // All will execute concurrently within this step, competing for 3 available connections
    step(
      'parallel-queries',
      async (ctx: StepContext): Promise<StepResult<MockDatabaseData[]>> => {
        console.log('\n💾 Step 2: Execute 5 Parallel Queries');
        console.log('═'.repeat(50));
        console.log('  Launching 5 queries concurrently to compete for 3 connections...\n');

        try {
          // Launch all 5 queries simultaneously
          const queryPromises = Array.from({ length: 5 }, (_, i) => {
            console.log(`  🚀 Launching Query ${i + 1}`);
            return mockDatabaseService({
              ...ctx,
              metadata: {
                ...ctx.metadata,
                config: {
                  maxConnections: 3,
                  queryDelay: 2000,
                  shouldFail: false,
                },
              },
            });
          });

          // Wait for all queries to complete
          const results = await Promise.all(queryPromises);

          // Check if any queries failed
          const failures = results.filter(r => !r.success);
          if (failures.length > 0) {
            return {
              success: false,
              error: `${failures.length} queries failed`,
            };
          }

          // Extract data from successful results
          const queryData = results.map(r => r.data!);

          console.log(`\n  ✅ All 5 queries completed successfully`);

          return {
            success: true,
            data: queryData,
          };
        } catch (error: any) {
          console.error(`  ❌ Parallel queries error:`, error.message);
          return {
            success: false,
            error: `Parallel queries failed: ${error.message}`,
          };
        }
      }
    ),

    // Step 3: Pool Metrics Analyzer
    step(
      'pool-metrics-analyzer',
      async (ctx: StepContext): Promise<StepResult<PoolMetricsSummary>> => {
        console.log('\n📊 Step 3: Pool Metrics Analysis');
        console.log('═'.repeat(50));

        try {
          const parallelQueries = ctx.prevResults['parallel-queries'] as StepResult<MockDatabaseData[]>;

          if (!parallelQueries || !parallelQueries.success || !parallelQueries.data) {
            return {
              success: false,
              error: 'No parallel queries results found',
            };
          }

          const queries = parallelQueries.data;

          // Analyze query timings
          const queryTimings = queries.map((data) => {
            const executionTime = data.executionTime;
            const queryDelay = 2000;
            const waitTime = Math.max(0, executionTime - queryDelay);

            return {
              queryId: data.queryId,
              connectionId: data.connectionId,
              executionTime,
              waitTime,
            };
          });

          // Calculate metrics
          const peakActiveConnections = Math.max(
            ...queries.map((data) => data.poolStats.activeConnections || 0)
          );

          const maxQueueLength = Math.max(
            ...queries.map((data) => data.poolStats.queueLength || 0)
          );

          const averageWaitTime =
            queryTimings.reduce((sum, timing) => sum + timing.waitTime, 0) / queryTimings.length;

          // Validation
          const tolerance = 500; // 500ms tolerance
          const peakUsageValid = peakActiveConnections <= 3;

          // First 3 queries should have near-zero wait time
          const firstThreeWaits = queryTimings.slice(0, 3).map(t => t.waitTime);
          const firstThreeValid = firstThreeWaits.every(wait => wait < tolerance);

          // Last 2 queries should wait ~2000ms (one query delay)
          const lastTwoWaits = queryTimings.slice(3, 5).map(t => t.waitTime);
          const lastTwoValid = lastTwoWaits.every(wait =>
            Math.abs(wait - 2000) < tolerance
          );

          const waitTimesValid = firstThreeValid && lastTwoValid;

          // Total execution time should be ~4000ms (2 rounds of 2000ms)
          const totalExecutionTime = Math.max(...queryTimings.map(t => t.executionTime));
          const expectedExecutionTime = 4000;
          const executionTimeValid =
            Math.abs(totalExecutionTime - expectedExecutionTime) < tolerance;

          // Display results
          console.log(`\n  📈 Pool Metrics:`);
          console.log(`     Total Queries: 5`);
          console.log(`     Peak Active Connections: ${peakActiveConnections}/3 ${peakUsageValid ? '✅' : '❌'}`);
          console.log(`     Max Queue Length: ${maxQueueLength}`);
          console.log(`     Average Wait Time: ${averageWaitTime.toFixed(0)}ms`);

          console.log(`\n  ⏱️  Query Timings:`);
          queryTimings.forEach((timing, i) => {
            const expected = i < 3 ? '~0ms wait' : '~2000ms wait';
            const valid = i < 3
              ? timing.waitTime < tolerance
              : Math.abs(timing.waitTime - 2000) < tolerance;

            console.log(
              `     ${valid ? '✅' : '❌'} Query ${i + 1}: ${timing.executionTime}ms total, ${timing.waitTime}ms wait (${expected})`
            );
          });

          console.log(`\n  🎯 Validation Results:`);
          console.log(`     ${peakUsageValid ? '✅' : '❌'} Peak usage within limit (${peakActiveConnections} ≤ 3)`);
          console.log(`     ${waitTimesValid ? '✅' : '❌'} Wait times as expected`);
          console.log(`     ${executionTimeValid ? '✅' : '❌'} Total execution time ~4000ms`);

          const summary: PoolMetricsSummary = {
            totalQueries: 5,
            peakActiveConnections,
            maxQueueLength,
            averageWaitTime,
            queryTimings,
            poolConfiguration: {
              maxConnections: 3,
              queryDelay: 2000,
            },
            validationResults: {
              peakUsageValid,
              waitTimesValid,
              executionTimeValid,
            },
          };

          const allValid = peakUsageValid && waitTimesValid && executionTimeValid;
          console.log(`\n  ${allValid ? '✅' : '❌'} All validations passed: ${allValid}`);

          return {
            success: true,
            data: summary,
          };
        } catch (error: any) {
          console.error(`  ❌ Pool metrics analysis error:`, error.message);
          return {
            success: false,
            error: `Pool metrics analysis failed: ${error.message}`,
          };
        }
      }
    ),
  ],
});
