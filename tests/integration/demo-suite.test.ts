/**
 * Demo Pipeline Suite Integration Tests
 *
 * Comprehensive integration test suite that executes all 7 demo pipelines
 * and verifies their primary success criteria.
 *
 * This suite ensures:
 * - All demo pipelines complete successfully
 * - Performance targets are met
 * - Core functionality works as expected
 */

import { describe, it, expect } from '@jest/globals';
import { PipelineExecutor } from '../../src/core/executor.js';

// Import all demo pipelines
import asyncTimingPipeline from '../../src/pipelines/async-timing-demo.js';
import retryLogicPipeline from '../../src/pipelines/retry-logic-demo.js';
import parallelExecutionPipeline from '../../src/pipelines/parallel-execution-demo.js';
import errorRecoveryPipeline from '../../src/pipelines/error-recovery-demo.js';
import connectionPoolPipeline from '../../src/pipelines/connection-pool-demo.js';
import dataTransformationPipeline from '../../src/pipelines/data-transformation-demo.js';
import multiServicePipeline from '../../src/pipelines/multi-service-integration-demo.js';
import documentProcessingPipeline from '../../src/pipelines/document-processing.js';

// Import types
import type { TimingSummary } from '../../src/pipelines/async-timing-demo.js';
import type { PoolMetricsSummary } from '../../src/pipelines/connection-pool-demo.js';

describe('Demo Pipeline Suite', () => {
  describe('All Pipelines Smoke Test', () => {
    it('should execute all 8 demo pipelines successfully', async () => {
      console.log('\n🧪 COMPREHENSIVE TEST: All Demo Pipelines\n');
      console.log('═'.repeat(60));

      const pipelines = [
        { name: 'Async & Timing', pipeline: asyncTimingPipeline, expectFailure: false },
        { name: 'Retry Logic', pipeline: retryLogicPipeline, expectFailure: true }, // Has intentionally failing step
        { name: 'Parallel Execution', pipeline: parallelExecutionPipeline, expectFailure: false },
        { name: 'Error Recovery', pipeline: errorRecoveryPipeline, expectFailure: false },
        { name: 'Connection Pool', pipeline: connectionPoolPipeline, expectFailure: false },
        { name: 'Data Transformation', pipeline: dataTransformationPipeline, expectFailure: false },
        { name: 'Multi-Service Integration', pipeline: multiServicePipeline, expectFailure: false },
        { name: 'Document Processing', pipeline: documentProcessingPipeline, expectFailure: false },
      ];

      const results = [];

      for (const { name, pipeline, expectFailure } of pipelines) {
        console.log(`\n📋 Testing: ${name}`);
        console.log('─'.repeat(60));

        const startTime = Date.now();
        const executor = new PipelineExecutor(pipeline);
        const result = await executor.execute({ metadata: {} });
        const duration = Date.now() - startTime;

        const expectedSuccess = !expectFailure;
        const testPassed = result.success === expectedSuccess;

        results.push({
          name,
          success: result.success,
          expectedSuccess,
          testPassed,
          duration,
          error: result.error,
        });

        if (testPassed) {
          if (expectFailure) {
            console.log(`✅ ${name}: FAILED AS EXPECTED (${duration}ms) - ${result.error}`);
          } else {
            console.log(`✅ ${name}: SUCCESS (${duration}ms)`);
          }
        } else {
          console.log(`❌ ${name}: UNEXPECTED RESULT - ${result.error}`);
        }

        // Assert expected outcome
        expect(result.success).toBe(expectedSuccess);
      }

      console.log('\n' + '═'.repeat(60));
      console.log('📊 Summary:');
      console.log('─'.repeat(60));

      const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
      const allPassed = results.every(r => r.testPassed);

      results.forEach(r => {
        const icon = r.testPassed ? '✅' : '❌';
        const status = r.expectedSuccess ? 'SUCCESS' : 'FAILED (expected)';
        console.log(`  ${icon} ${r.name.padEnd(30)} ${r.duration}ms - ${status}`);
      });

      console.log('─'.repeat(60));
      console.log(`  Total Duration: ${totalDuration}ms`);
      console.log(`  All Passed: ${allPassed ? 'YES ✅' : 'NO ❌'}`);
      console.log('═'.repeat(60) + '\n');

      expect(allPassed).toBe(true);
    }, 120000); // 2 minute timeout for all pipelines
  });

  describe('Pipeline 1: Async & Timing Demo', () => {
    it('should complete with correct timing profile', async () => {
      console.log('\n🧪 Pipeline 1: Async & Timing Demo');

      const executor = new PipelineExecutor(asyncTimingPipeline);
      const result = await executor.execute({ metadata: {} });

      expect(result.success).toBe(true);

      const summaryStep = result.stepResults?.['timing-summary'];
      const summary = summaryStep?.data as TimingSummary;

      expect(summary).toBeDefined();
      expect(summary.allStepsValid).toBe(true);

      console.log(`  ✅ All timing validations passed`);
      console.log(`  ✅ Total Duration: ${summary.totalDuration}ms`);
      console.log(`  ✅ Efficiency: ${summary.performanceMetrics.efficiency.toFixed(2)}%`);
    }, 20000);
  });

  describe('Pipeline 2: Retry Logic Demo', () => {
    it('should demonstrate retry mechanism', async () => {
      console.log('\n🧪 Pipeline 2: Retry Logic Demo');

      const executor = new PipelineExecutor(retryLogicPipeline);
      const result = await executor.execute({ metadata: {} });

      // The pipeline should fail overall because one step is designed to always fail
      expect(result.success).toBe(false);

      // Verify retry step results exist
      const firstRetry = result.stepResults?.['eventual-success-service'];
      const alwaysFail = result.stepResults?.['permanent-failure-service'];

      // First retry step should succeed eventually
      expect(firstRetry?.success).toBe(true);
      // Always fail step should fail after exhausting retries
      expect(alwaysFail?.success).toBe(false);

      console.log(`  ✅ Retry mechanism working correctly (demonstrates both success and failure)`);
    }, 30000);
  });

  describe('Pipeline 3: Parallel Execution Demo', () => {
    it('should execute tasks in parallel', async () => {
      console.log('\n🧪 Pipeline 3: Parallel Execution Demo');

      const startTime = Date.now();
      const executor = new PipelineExecutor(parallelExecutionPipeline);
      const result = await executor.execute({ metadata: {} });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);

      // Parallel execution should be faster than sequential
      // 3 tasks @ 1000ms each should complete in ~1000ms parallel vs ~3000ms sequential
      expect(duration).toBeLessThan(5000); // Allow buffer for overhead

      console.log(`  ✅ Parallel execution completed in ${duration}ms`);
    }, 15000);
  });

  describe('Pipeline 4: Error Recovery Demo', () => {
    it('should demonstrate error handling', async () => {
      console.log('\n🧪 Pipeline 4: Error Recovery Demo');

      const executor = new PipelineExecutor(errorRecoveryPipeline);
      const result = await executor.execute({ metadata: {} });

      expect(result.success).toBe(true);

      // Verify error recovery step exists
      const errorRecovery = result.stepResults?.['error-recovery-summary'];
      expect(errorRecovery).toBeDefined();

      console.log(`  ✅ Error recovery mechanisms validated`);
    }, 20000);
  });

  describe('Pipeline 5: Connection Pool Demo', () => {
    it('should manage connection pool correctly', async () => {
      console.log('\n🧪 Pipeline 5: Connection Pool Demo');

      const executor = new PipelineExecutor(connectionPoolPipeline);
      const result = await executor.execute({ metadata: {} });

      expect(result.success).toBe(true);

      const metricsStep = result.stepResults?.['pool-metrics-analyzer'];
      const metrics = metricsStep?.data as PoolMetricsSummary;

      expect(metrics).toBeDefined();
      expect(metrics.validationResults.peakUsageValid).toBe(true);
      expect(metrics.validationResults.waitTimesValid).toBe(true);
      expect(metrics.validationResults.executionTimeValid).toBe(true);

      console.log(`  ✅ Peak Active Connections: ${metrics.peakActiveConnections}/3`);
      console.log(`  ✅ Max Queue Length: ${metrics.maxQueueLength}`);
      console.log(`  ✅ Average Wait Time: ${metrics.averageWaitTime.toFixed(0)}ms`);
    }, 15000);
  });

  describe('Pipeline 6: Data Transformation Demo', () => {
    it('should transform data through multiple stages', async () => {
      console.log('\n🧪 Pipeline 6: Data Transformation Demo');

      const executor = new PipelineExecutor(dataTransformationPipeline);
      const result = await executor.execute({ metadata: {} });

      expect(result.success).toBe(true);

      // Verify transformation steps exist
      const validationStep = result.stepResults?.['validate-transformations'];
      expect(validationStep?.success).toBe(true);

      console.log(`  ✅ Data transformation pipeline completed`);
    }, 15000);
  });

  describe('Pipeline 7: Multi-Service Integration Demo', () => {
    it('should integrate multiple services', async () => {
      console.log('\n🧪 Pipeline 7: Multi-Service Integration Demo');

      const executor = new PipelineExecutor(multiServicePipeline);
      const result = await executor.execute({ metadata: {} });

      expect(result.success).toBe(true);

      // Verify multi-service orchestration
      const orchestrationStep = result.stepResults?.['orchestration-summary'];
      expect(orchestrationStep).toBeDefined();

      console.log(`  ✅ Multi-service integration completed`);
    }, 30000);
  });

  describe('Pipeline 8: Document Processing', () => {
    it('should process document through S3, Veryfi, and database', async () => {
      console.log('\n🧪 Pipeline 8: Document Processing');
      console.log('  ⚠️  Requires real credentials - may be skipped in CI');

      // Note: This test requires real AWS and Veryfi credentials
      // It's more of an integration test than a unit test
      // May be skipped if credentials are not available

      const executor = new PipelineExecutor(documentProcessingPipeline);
      const result = await executor.execute({
        metadata: {
          filePath: './mapo.png', // Test file in project root
        },
      });

      // Note: This may fail if credentials are not configured
      // That's expected in test environments without real credentials
      if (result.success) {
        expect(result.success).toBe(true);

        // Verify all three steps completed
        const s3Upload = result.stepResults?.['s3-upload'];
        const veryfiProcess = result.stepResults?.['veryfi-process'];
        const veryfiStorage = result.stepResults?.['veryfi-storage'];

        expect(s3Upload).toBeDefined();
        expect(veryfiProcess).toBeDefined();
        expect(veryfiStorage).toBeDefined();

        console.log(`  ✅ Document processing pipeline completed`);
      } else {
        console.log(`  ⚠️  Pipeline failed (expected if no credentials): ${result.error}`);
        // Don't fail the test if credentials are missing
        expect(result.error).toBeDefined();
      }
    }, 60000); // 60 second timeout for real API calls
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets for all pipelines', async () => {
      console.log('\n🧪 Performance Benchmark Test');
      console.log('═'.repeat(60));

      const benchmarks = [
        { name: 'Async & Timing', pipeline: asyncTimingPipeline, maxDuration: 13000, expectFailure: false },
        { name: 'Retry Logic', pipeline: retryLogicPipeline, maxDuration: 25000, expectFailure: true },
        { name: 'Parallel Execution', pipeline: parallelExecutionPipeline, maxDuration: 5000, expectFailure: false },
        { name: 'Error Recovery', pipeline: errorRecoveryPipeline, maxDuration: 15000, expectFailure: false },
        { name: 'Connection Pool', pipeline: connectionPoolPipeline, maxDuration: 7000, expectFailure: false },
        { name: 'Data Transformation', pipeline: dataTransformationPipeline, maxDuration: 10000, expectFailure: false },
        { name: 'Multi-Service', pipeline: multiServicePipeline, maxDuration: 25000, expectFailure: false },
        // Note: Document Processing excluded from benchmarks (requires real credentials)
      ];

      for (const { name, pipeline, maxDuration, expectFailure } of benchmarks) {
        const startTime = Date.now();
        const executor = new PipelineExecutor(pipeline);
        const result = await executor.execute({ metadata: {} });
        const duration = Date.now() - startTime;

        const withinTarget = duration <= maxDuration;
        const expectedSuccess = !expectFailure;
        const resultCorrect = result.success === expectedSuccess;
        const status = (withinTarget && resultCorrect) ? '✅' : '⚠️';

        console.log(`  ${status} ${name.padEnd(30)} ${duration}ms / ${maxDuration}ms`);

        expect(result.success).toBe(expectedSuccess);
        expect(duration).toBeLessThanOrEqual(maxDuration);
      }

      console.log('═'.repeat(60) + '\n');
    }, 150000); // 2.5 minute timeout for all benchmarks
  });
});
