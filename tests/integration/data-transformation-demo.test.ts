/**
 * Data Transformation Demo Pipeline Integration Tests
 *
 * Tests for the multi-stage data processing pipeline including:
 * - Data generation and filtering
 * - Data transformation
 * - Parallel analysis execution
 * - Result merging and performance metrics
 */

import { describe, it, expect } from '@jest/globals';
import { PipelineExecutor } from '../../src/core/executor.js';
import dataTransformationPipeline from '../../src/pipelines/data-transformation-demo.js';
import type {
  RawDataItem,
  TransformedDataItem,
  AnalysisResult,
  MergedAnalysisResult,
} from '../../src/pipelines/data-transformation-demo.js';

describe('Data Transformation Demo Pipeline', () => {
  describe('Success Path', () => {
    it('should complete all stages successfully', async () => {
      console.log('\n🧪 TEST: Data Transformation - Full pipeline execution\n');

      const executor = new PipelineExecutor(dataTransformationPipeline);

      const result = await executor.execute({
        metadata: {},
      });

      // Verify pipeline completed successfully
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify all 6 steps completed
      const stepResults = result.stepResults || {};
      expect(Object.keys(stepResults).length).toBe(6);

      console.log(`\n✅ All ${Object.keys(stepResults).length} steps completed\n`);
    }, 30000); // 30 second timeout for parallel processing

    it('should generate 1000 data items', async () => {
      console.log('\n🧪 TEST: Data Generation Step\n');

      const executor = new PipelineExecutor(dataTransformationPipeline);
      const result = await executor.execute({ metadata: {} });

      const generatorStep = result.stepResults?.['data-generator'];
      expect(generatorStep?.success).toBe(true);

      const rawData = generatorStep?.data as RawDataItem[];
      expect(rawData).toBeDefined();
      expect(rawData.length).toBe(1000);

      // Verify data structure
      expect(rawData[0]).toHaveProperty('id');
      expect(rawData[0]).toHaveProperty('value');
      expect(rawData[0]).toHaveProperty('category');
      expect(rawData[0]).toHaveProperty('timestamp');

      // Verify value range
      const values = rawData.map((item) => item.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeLessThanOrEqual(99);

      console.log(`  ✅ Generated ${rawData.length} items with values ${min}-${max}`);
    }, 10000);

    it('should filter items with value > 50', async () => {
      console.log('\n🧪 TEST: Filter Step\n');

      const executor = new PipelineExecutor(dataTransformationPipeline);
      const result = await executor.execute({ metadata: {} });

      const filterStep = result.stepResults?.['filter-step'];
      expect(filterStep?.success).toBe(true);

      const filteredData = filterStep?.data as RawDataItem[];
      expect(filteredData).toBeDefined();

      // Verify all items have value > 50
      filteredData.forEach((item) => {
        expect(item.value).toBeGreaterThan(50);
      });

      // Verify filtering actually removed items
      const generatorStep = result.stepResults?.['data-generator'];
      const rawData = generatorStep?.data as RawDataItem[];
      expect(filteredData.length).toBeLessThan(rawData.length);

      const removedCount = rawData.length - filteredData.length;
      console.log(`  ✅ Filtered ${rawData.length} → ${filteredData.length} (removed ${removedCount})`);
    }, 10000);

    it('should add score and processedAt fields in transform step', async () => {
      console.log('\n🧪 TEST: Transform Step\n');

      const executor = new PipelineExecutor(dataTransformationPipeline);
      const result = await executor.execute({ metadata: {} });

      const transformStep = result.stepResults?.['transform-step'];
      expect(transformStep?.success).toBe(true);

      const transformedData = transformStep?.data as TransformedDataItem[];
      expect(transformedData).toBeDefined();

      // Verify all items have new fields
      transformedData.forEach((item) => {
        expect(item).toHaveProperty('score');
        expect(item).toHaveProperty('processedAt');

        // Verify score calculation (value * 1.5)
        expect(item.score).toBe(item.value * 1.5);

        // Verify processedAt is a valid ISO timestamp
        expect(new Date(item.processedAt).toISOString()).toBe(item.processedAt);
      });

      console.log(`  ✅ Transformed ${transformedData.length} items with score and processedAt`);
    }, 10000);

    it('should execute analyzers in parallel (not sequential)', async () => {
      console.log('\n🧪 TEST: Parallel Execution Performance\n');

      const executor = new PipelineExecutor(dataTransformationPipeline);
      const result = await executor.execute({ metadata: {} });

      const alphaStep = result.stepResults?.['parallel-analyzer-alpha'];
      const betaStep = result.stepResults?.['parallel-analyzer-beta'];
      const mergeStep = result.stepResults?.['merge-analysis'];

      expect(alphaStep?.success).toBe(true);
      expect(betaStep?.success).toBe(true);
      expect(mergeStep?.success).toBe(true);

      // Check the parallel processing metrics from merge-analysis
      const mergedResult = mergeStep?.data as MergedAnalysisResult;
      const { parallelProcessingTime, estimatedSequentialTime, efficiency } = mergedResult.performanceMetrics;

      // Alpha has 2000ms delay, Beta has 3000ms delay
      // Parallel: ~3000ms (max of 2s and 3s), Sequential: ~5000ms (2s + 3s)
      expect(parallelProcessingTime).toBeLessThan(3500); // Should be ~3000ms with overhead
      expect(parallelProcessingTime).toBeGreaterThan(2500); // At least 2.5s
      expect(estimatedSequentialTime).toBeGreaterThanOrEqual(4500); // Should be ~5000ms
      expect(efficiency).toBeGreaterThan(30); // Should save >30% time

      console.log(`  ✅ Parallel: ${parallelProcessingTime}ms vs Sequential: ${estimatedSequentialTime}ms (${efficiency.toFixed(1)}% efficient)`);
    }, 15000);

    it('should correctly analyze data subsets', async () => {
      console.log('\n🧪 TEST: Analysis Results\n');

      const executor = new PipelineExecutor(dataTransformationPipeline);
      const result = await executor.execute({ metadata: {} });

      const alphaStep = result.stepResults?.['parallel-analyzer-alpha'];
      const betaStep = result.stepResults?.['parallel-analyzer-beta'];

      const alphaResult = alphaStep?.data as AnalysisResult;
      const betaResult = betaStep?.data as AnalysisResult;

      expect(alphaResult).toBeDefined();
      expect(betaResult).toBeDefined();

      // Verify subset identifiers
      expect(alphaResult.subset).toBe('alpha');
      expect(betaResult.subset).toBe('beta');

      // Verify both subsets have items
      expect(alphaResult.itemCount).toBeGreaterThan(0);
      expect(betaResult.itemCount).toBeGreaterThan(0);

      // Verify statistics are calculated
      expect(alphaResult.statistics.min).toBeGreaterThan(50);
      expect(alphaResult.statistics.max).toBeLessThanOrEqual(99);
      expect(alphaResult.statistics.average).toBeGreaterThan(50);
      expect(alphaResult.statistics.sum).toBeGreaterThan(0);

      expect(betaResult.statistics.min).toBeGreaterThan(50);
      expect(betaResult.statistics.max).toBeLessThanOrEqual(99);
      expect(betaResult.statistics.average).toBeGreaterThan(50);
      expect(betaResult.statistics.sum).toBeGreaterThan(0);

      console.log(`  ✅ Alpha: ${alphaResult.itemCount} items, avg ${alphaResult.statistics.average.toFixed(2)}`);
      console.log(`  ✅ Beta: ${betaResult.itemCount} items, avg ${betaResult.statistics.average.toFixed(2)}`);
    }, 15000);

    it('should correctly merge analysis results and calculate global statistics', async () => {
      console.log('\n🧪 TEST: Merge Analysis\n');

      const executor = new PipelineExecutor(dataTransformationPipeline);
      const result = await executor.execute({ metadata: {} });

      const mergeStep = result.stepResults?.['merge-analysis'];
      expect(mergeStep?.success).toBe(true);

      const mergedResult = mergeStep?.data as MergedAnalysisResult;
      expect(mergedResult).toBeDefined();

      // Verify total items matches alpha + beta
      const alphaStep = result.stepResults?.['parallel-analyzer-alpha'];
      const betaStep = result.stepResults?.['parallel-analyzer-beta'];
      const alphaResult = alphaStep?.data as AnalysisResult;
      const betaResult = betaStep?.data as AnalysisResult;

      expect(mergedResult.totalItems).toBe(alphaResult.itemCount + betaResult.itemCount);

      // Verify global min/max
      const expectedMin = Math.min(alphaResult.statistics.min, betaResult.statistics.min);
      const expectedMax = Math.max(alphaResult.statistics.max, betaResult.statistics.max);
      expect(mergedResult.globalStatistics.min).toBe(expectedMin);
      expect(mergedResult.globalStatistics.max).toBe(expectedMax);

      // Verify performance metrics show parallel efficiency
      expect(mergedResult.performanceMetrics.parallelProcessingTime).toBeLessThan(
        mergedResult.performanceMetrics.estimatedSequentialTime
      );
      expect(mergedResult.performanceMetrics.timeSaved).toBeGreaterThan(0);
      expect(mergedResult.performanceMetrics.efficiency).toBeGreaterThan(0);
      expect(mergedResult.performanceMetrics.efficiency).toBeLessThanOrEqual(100);

      console.log(`  ✅ Total Items: ${mergedResult.totalItems}`);
      console.log(`  ✅ Global Min: ${mergedResult.globalStatistics.min}, Max: ${mergedResult.globalStatistics.max}`);
      console.log(`  ✅ Time Saved: ${mergedResult.performanceMetrics.timeSaved}ms (${mergedResult.performanceMetrics.efficiency.toFixed(1)}% efficient)`);
    }, 15000);

    it('should maintain category distribution across pipeline', async () => {
      console.log('\n🧪 TEST: Category Distribution\n');

      const executor = new PipelineExecutor(dataTransformationPipeline);
      const result = await executor.execute({ metadata: {} });

      const mergeStep = result.stepResults?.['merge-analysis'];
      const mergedResult = mergeStep?.data as MergedAnalysisResult;

      // Verify category distribution exists
      expect(mergedResult.categoryDistribution).toBeDefined();

      // Verify categories match expected values (A, B, C, D, E)
      const expectedCategories = ['A', 'B', 'C', 'D', 'E'];
      const actualCategories = Object.keys(mergedResult.categoryDistribution);

      actualCategories.forEach((cat) => {
        expect(expectedCategories).toContain(cat);
        expect(mergedResult.categoryDistribution[cat]).toBeGreaterThan(0);
      });

      // Verify total category counts match total items
      const totalCategoryCount = Object.values(mergedResult.categoryDistribution).reduce((a, b) => a + b, 0);
      expect(totalCategoryCount).toBe(mergedResult.totalItems);

      console.log(`  ✅ Category Distribution:`);
      Object.entries(mergedResult.categoryDistribution).forEach(([cat, count]) => {
        console.log(`     ${cat}: ${count} items`);
      });
    }, 15000);
  });
});
