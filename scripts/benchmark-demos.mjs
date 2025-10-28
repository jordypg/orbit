#!/usr/bin/env node

/**
 * Demo Pipeline Suite Benchmark Script
 *
 * Runs all 7 demo pipelines and measures their performance against
 * the targets specified in the PRD.
 *
 * Usage:
 *   node scripts/benchmark-demos.mjs
 *   node scripts/benchmark-demos.mjs --runs=5  # Run each pipeline 5 times
 */

import { PipelineExecutor } from '../dist/core/executor.js';

// Import all demo pipelines
import asyncTimingPipeline from '../dist/pipelines/async-timing-demo.js';
import retryLogicPipeline from '../dist/pipelines/retry-logic-demo.js';
import parallelExecutionPipeline from '../dist/pipelines/parallel-execution-demo.js';
import errorRecoveryPipeline from '../dist/pipelines/error-recovery-demo.js';
import connectionPoolPipeline from '../dist/pipelines/connection-pool-demo.js';
import dataTransformationPipeline from '../dist/pipelines/data-transformation-demo.js';
import multiServicePipeline from '../dist/pipelines/multi-service-integration-demo.js';
import documentProcessingPipeline from '../dist/pipelines/document-processing.js';

/**
 * Performance targets from PRD (in milliseconds)
 */
const PERFORMANCE_TARGETS = {
  'async-timing-demo': {
    expected: 10000, // 5000 + 2000 + 0 + 3000
    max: 13000,
    tolerance: 3000,
    description: 'Sequential execution with delays: 5s + 2s + 0s + 3s'
  },
  'retry-logic-demo': {
    expected: 15000,
    max: 25000,
    tolerance: 10000,
    description: 'Multiple retries with exponential backoff'
  },
  'parallel-execution-demo': {
    expected: 1000,
    max: 5000,
    tolerance: 4000,
    description: '3 parallel 1s tasks should complete in ~1s'
  },
  'error-recovery-demo': {
    expected: 5000,
    max: 15000,
    tolerance: 10000,
    description: 'Error handling and recovery mechanisms'
  },
  'connection-pool-demo': {
    expected: 4000,
    max: 7000,
    tolerance: 3000,
    description: '5 queries @ 2s with 3 connection pool (2 rounds)'
  },
  'data-transformation-demo': {
    expected: 5000,
    max: 10000,
    tolerance: 5000,
    description: 'Multi-stage data transformation pipeline'
  },
  'multi-service-integration-demo': {
    expected: 15000,
    max: 25000,
    tolerance: 10000,
    description: 'Integration of multiple mock services'
  },
  'document-processing': {
    expected: 10000,
    max: 30000,
    tolerance: 20000,
    description: 'Real API integration (S3 + Veryfi + PostgreSQL)'
  },
};

/**
 * Pipeline configurations
 */
const PIPELINES = [
  { name: 'async-timing-demo', displayName: 'Async & Timing Demo', pipeline: asyncTimingPipeline },
  { name: 'retry-logic-demo', displayName: 'Retry Logic Demo', pipeline: retryLogicPipeline },
  { name: 'parallel-execution-demo', displayName: 'Parallel Execution Demo', pipeline: parallelExecutionPipeline },
  { name: 'error-recovery-demo', displayName: 'Error Recovery Demo', pipeline: errorRecoveryPipeline },
  { name: 'connection-pool-demo', displayName: 'Connection Pool Demo', pipeline: connectionPoolPipeline },
  { name: 'data-transformation-demo', displayName: 'Data Transformation Demo', pipeline: dataTransformationPipeline },
  { name: 'multi-service-integration-demo', displayName: 'Multi-Service Integration', pipeline: multiServicePipeline },
  // Note: Document Processing excluded from benchmarks (requires real AWS/Veryfi credentials)
  // { name: 'document-processing', displayName: 'Document Processing', pipeline: documentProcessingPipeline },
];

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    runs: 1,
    verbose: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--runs=')) {
      options.runs = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }

  return options;
}

/**
 * Run a single pipeline and measure performance
 */
async function benchmarkPipeline(name, displayName, pipeline, runs = 1, verbose = false) {
  const durations = [];
  let successCount = 0;
  let failureCount = 0;

  console.log(`\n📋 Benchmarking: ${displayName}`);
  console.log('─'.repeat(70));

  for (let run = 1; run <= runs; run++) {
    if (verbose || runs > 1) {
      console.log(`  Run ${run}/${runs}...`);
    }

    try {
      const startTime = Date.now();
      const executor = new PipelineExecutor(pipeline);
      const result = await executor.execute({ metadata: {} });
      const duration = Date.now() - startTime;

      durations.push(duration);

      if (result.success) {
        successCount++;
        if (verbose) {
          console.log(`    ✅ Success in ${duration}ms`);
        }
      } else {
        failureCount++;
        if (verbose) {
          console.log(`    ❌ Failed: ${result.error}`);
        }
      }
    } catch (error) {
      failureCount++;
      if (verbose) {
        console.log(`    ❌ Error: ${error.message}`);
      }
    }
  }

  const target = PERFORMANCE_TARGETS[name];
  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const withinTarget = avgDuration <= target.max;

  return {
    name,
    displayName,
    target,
    successCount,
    failureCount,
    totalRuns: runs,
    durations,
    avgDuration,
    minDuration,
    maxDuration,
    withinTarget,
  };
}

/**
 * Display benchmark results
 */
function displayResults(results) {
  console.log('\n' + '═'.repeat(70));
  console.log('📊 BENCHMARK RESULTS');
  console.log('═'.repeat(70));

  let allPassed = true;

  results.forEach(result => {
    const { displayName, target, avgDuration, minDuration, maxDuration, withinTarget, successCount, totalRuns } = result;

    const status = withinTarget ? '✅' : '⚠️';
    const successRate = ((successCount / totalRuns) * 100).toFixed(0);

    console.log(`\n${status} ${displayName}`);
    console.log(`   Target: ${target.expected}ms (max: ${target.max}ms)`);
    console.log(`   Average: ${avgDuration.toFixed(0)}ms`);

    if (totalRuns > 1) {
      console.log(`   Range: ${minDuration}ms - ${maxDuration}ms`);
    }

    console.log(`   Success Rate: ${successRate}% (${successCount}/${totalRuns})`);
    console.log(`   Status: ${withinTarget ? 'PASSED ✅' : 'WARNING: Exceeded target ⚠️'}`);

    if (!withinTarget) {
      allPassed = false;
      const excess = avgDuration - target.max;
      console.log(`   ⚠️  Exceeded by ${excess.toFixed(0)}ms`);
    }
  });

  console.log('\n' + '═'.repeat(70));
  console.log('📈 SUMMARY');
  console.log('═'.repeat(70));

  const totalDuration = results.reduce((sum, r) => sum + r.avgDuration, 0);
  const passedCount = results.filter(r => r.withinTarget).length;
  const failedCount = results.length - passedCount;

  console.log(`Total Average Duration: ${totalDuration.toFixed(0)}ms`);
  console.log(`Pipelines Passed: ${passedCount}/${results.length}`);
  console.log(`Pipelines Failed: ${failedCount}/${results.length}`);
  console.log(`Overall Status: ${allPassed ? 'ALL PASSED ✅' : 'SOME WARNINGS ⚠️'}`);
  console.log('═'.repeat(70) + '\n');

  return allPassed;
}

/**
 * Generate JSON report
 */
function generateJsonReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalPipelines: results.length,
      passed: results.filter(r => r.withinTarget).length,
      failed: results.filter(r => !r.withinTarget).length,
      totalDuration: results.reduce((sum, r) => sum + r.avgDuration, 0),
    },
    pipelines: results.map(r => ({
      name: r.name,
      displayName: r.displayName,
      target: r.target,
      performance: {
        avgDuration: r.avgDuration,
        minDuration: r.minDuration,
        maxDuration: r.maxDuration,
      },
      success: {
        count: r.successCount,
        total: r.totalRuns,
        rate: (r.successCount / r.totalRuns) * 100,
      },
      withinTarget: r.withinTarget,
    })),
  };

  return report;
}

/**
 * Main benchmark execution
 */
async function main() {
  console.log('\n🚀 Demo Pipeline Suite Benchmark');
  console.log('═'.repeat(70));

  const options = parseArgs();

  console.log(`Configuration:`);
  console.log(`  Runs per pipeline: ${options.runs}`);
  console.log(`  Verbose output: ${options.verbose}`);

  const results = [];

  for (const { name, displayName, pipeline } of PIPELINES) {
    const result = await benchmarkPipeline(name, displayName, pipeline, options.runs, options.verbose);
    results.push(result);
  }

  const allPassed = displayResults(results);

  // Generate JSON report
  const jsonReport = generateJsonReport(results);
  console.log('\n📄 JSON Report:');
  console.log(JSON.stringify(jsonReport, null, 2));

  if (!allPassed) {
    console.log('\n⚠️  Some pipelines exceeded performance targets.');
    process.exit(1);
  }

  console.log('\n✨ All benchmarks passed!');
  process.exit(0);
}

// Run the benchmark
main().catch(error => {
  console.error('\n❌ Benchmark failed:', error);
  process.exit(1);
});
