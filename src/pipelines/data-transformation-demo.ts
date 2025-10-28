/**
 * Data Transformation Demo Pipeline
 *
 * Demonstrates a multi-stage data processing workflow including:
 * - Data generation and filtering
 * - Data transformation and enrichment
 * - Parallel step execution for data analysis
 * - Result aggregation and merging
 *
 * This pipeline showcases:
 * - Sequential step execution with data flow (steps 1-3)
 * - Parallel step execution (steps 4 and 5 run simultaneously)
 * - Dependency-based orchestration (step 6 waits for 4 and 5)
 * - Data validation and integrity checks
 * - Statistical analysis and aggregation
 * - ~2x speedup from parallelizing analyzers (~2s vs ~4s sequential)
 */

import { definePipeline, step } from '../core/index.js';
import type { StepContext, StepResult } from '../core/types.js';

/**
 * Raw data item generated in the first step
 */
export interface RawDataItem {
  id: number;
  value: number;
  category: string;
  timestamp: string;
}

/**
 * Transformed data item with additional computed fields
 */
export interface TransformedDataItem extends RawDataItem {
  score: number;
  processedAt: string;
}

/**
 * Statistical analysis result for a data subset
 */
export interface AnalysisResult {
  subset: string;
  itemCount: number;
  statistics: {
    min: number;
    max: number;
    average: number;
    sum: number;
    scoreAverage: number;
  };
  categories: Record<string, number>;
  processingTime: number;
}

/**
 * Merged global analysis result
 */
export interface MergedAnalysisResult {
  totalItems: number;
  globalStatistics: {
    min: number;
    max: number;
    average: number;
    sum: number;
    scoreAverage: number;
  };
  subsetComparison: {
    alpha: AnalysisResult;
    beta: AnalysisResult;
  };
  categoryDistribution: Record<string, number>;
  performanceMetrics: {
    parallelProcessingTime: number;
    estimatedSequentialTime: number;
    timeSaved: number;
    efficiency: number; // percentage
  };
}

export default definePipeline({
  name: 'data-transformation-demo',
  description: 'Multi-stage data processing with filtering, transformation, parallel analysis, and result merging',

  steps: [
    // Step 1: Data Generator - Create raw data items
    step('data-generator', async (): Promise<StepResult<RawDataItem[]>> => {
      console.log('\n🔧 Step 1: Data Generator');
      console.log('═'.repeat(50));

      try {
        const startTime = Date.now();

        // Generate 1000 raw data items
        const itemCount = 1000;
        const categories = ['A', 'B', 'C', 'D', 'E'];
        const rawData: RawDataItem[] = [];

        console.log(`  📊 Generating ${itemCount} data items...`);

        const baseTimestamp = new Date().toISOString();
        for (let i = 0; i < itemCount; i++) {
          const categoryIndex = Math.floor(Math.random() * categories.length);
          rawData.push({
            id: i + 1,
            value: Math.floor(Math.random() * 100), // Random value 0-99
            category: categories[categoryIndex] as string,
            timestamp: baseTimestamp,
          });
        }

        const duration = Date.now() - startTime;

        console.log(`  ✅ Generated ${rawData.length} items`);
        console.log(`  ⏱️  Processing Time: ${duration}ms`);
        console.log(`  📈 Value range: 0-99`);
        console.log(`  📂 Categories: ${categories.join(', ')}`);

        return {
          success: true,
          data: rawData,
        };
      } catch (error: any) {
        console.error(`  ❌ Data generation error:`, error.message);
        return {
          success: false,
          error: `Data generation failed: ${error.message}`,
        };
      }
    }),

    // Step 2: Filter Step - Filter items with value > 50
    step('filter-step', async (ctx: StepContext): Promise<StepResult<RawDataItem[]>> => {
      console.log('\n🔍 Step 2: Filter Step');
      console.log('═'.repeat(50));

      try {
        // Get data from previous step
        const generatorResult = ctx.prevResults['data-generator'] as any;
        if (!generatorResult || !generatorResult.success) {
          const errorMsg = generatorResult?.error || 'No data from generator';
          console.error(`  ❌ Cannot filter: ${errorMsg}`);
          return {
            success: false,
            error: `Cannot filter: ${errorMsg}`,
          };
        }

        const rawData = generatorResult.data as RawDataItem[];
        const startTime = Date.now();

        console.log(`  📥 Received ${rawData.length} items`);
        console.log(`  🔎 Filtering items with value > 50...`);

        // Filter items with value > 50
        const filteredData = rawData.filter(item => item.value > 50);

        const duration = Date.now() - startTime;

        console.log(`  ✅ Filtered to ${filteredData.length} items`);
        console.log(`  📉 Removed ${rawData.length - filteredData.length} items`);
        console.log(`  ⏱️  Processing Time: ${duration}ms`);

        return {
          success: true,
          data: filteredData,
        };
      } catch (error: any) {
        console.error(`  ❌ Filter error:`, error.message);
        return {
          success: false,
          error: `Filter failed: ${error.message}`,
        };
      }
    }),

    // Step 3: Transform Step - Add score and processedAt fields
    step('transform-step', async (ctx: StepContext): Promise<StepResult<TransformedDataItem[]>> => {
      console.log('\n🔄 Step 3: Transform Step');
      console.log('═'.repeat(50));

      try {
        // Get data from previous step
        const filterResult = ctx.prevResults['filter-step'] as any;
        if (!filterResult || !filterResult.success) {
          const errorMsg = filterResult?.error || 'No data from filter';
          console.error(`  ❌ Cannot transform: ${errorMsg}`);
          return {
            success: false,
            error: `Cannot transform: ${errorMsg}`,
          };
        }

        const filteredData = filterResult.data as RawDataItem[];
        const startTime = Date.now();

        console.log(`  📥 Received ${filteredData.length} items`);
        console.log(`  🔧 Adding score and processedAt fields...`);

        // Transform data: add score (value * 1.5) and processedAt timestamp
        const transformedData: TransformedDataItem[] = filteredData.map(item => ({
          ...item,
          score: item.value * 1.5,
          processedAt: new Date().toISOString(),
        }));

        const duration = Date.now() - startTime;

        console.log(`  ✅ Transformed ${transformedData.length} items`);
        console.log(`  📊 Added fields: score, processedAt`);
        console.log(`  ⏱️  Processing Time: ${duration}ms`);

        return {
          success: true,
          data: transformedData,
        };
      } catch (error: any) {
        console.error(`  ❌ Transform error:`, error.message);
        return {
          success: false,
          error: `Transform failed: ${error.message}`,
        };
      }
    }),

    // Step 4: Parallel Analyzer Alpha - Analyze first half
    // This step will execute in parallel with beta analyzer
    step('parallel-analyzer-alpha', async (ctx: StepContext): Promise<StepResult<AnalysisResult>> => {
      console.log('\n📊 Step 4: Parallel Analyzer Alpha');
      console.log('═'.repeat(50));

      try {
        // Get data from transform step
        const transformResult = ctx.prevResults['transform-step'] as any;
        if (!transformResult || !transformResult.success) {
          const errorMsg = transformResult?.error || 'No data from transform';
          console.error(`  ❌ Cannot analyze: ${errorMsg}`);
          return {
            success: false,
            error: `Cannot analyze: ${errorMsg}`,
          };
        }

        const transformedData = transformResult.data as TransformedDataItem[];
        const startTime = Date.now();

        // Process first half
        const midpoint = Math.floor(transformedData.length / 2);
        const subset = transformedData.slice(0, midpoint);

        console.log(`  📥 Analyzing first half: ${subset.length} items (0 to ${midpoint - 1})`);

        // Simulate processing time (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Calculate statistics
        const values = subset.map(item => item.value);
        const scores = subset.map(item => item.score);
        const categories: Record<string, number> = {};

        subset.forEach(item => {
          categories[item.category] = (categories[item.category] || 0) + 1;
        });

        const duration = Date.now() - startTime;

        const result: AnalysisResult = {
          subset: 'alpha',
          itemCount: subset.length,
          statistics: {
            min: Math.min(...values),
            max: Math.max(...values),
            average: values.reduce((a, b) => a + b, 0) / values.length,
            sum: values.reduce((a, b) => a + b, 0),
            scoreAverage: scores.reduce((a, b) => a + b, 0) / scores.length,
          },
          categories,
          processingTime: duration,
        };

        console.log(`  ✅ Analysis complete`);
        console.log(`  📈 Min: ${result.statistics.min}, Max: ${result.statistics.max}, Avg: ${result.statistics.average.toFixed(2)}`);
        console.log(`  ⏱️  Processing Time: ${duration}ms`);

        return {
          success: true,
          data: result,
        };
      } catch (error: any) {
        console.error(`  ❌ Analysis error:`, error.message);
        return {
          success: false,
          error: `Analysis failed: ${error.message}`,
        };
      }
    }, {
      dependsOn: ['transform-step'], // Only depends on transform-step, can run in parallel with beta
    }),

    // Step 5: Parallel Analyzer Beta - Analyze second half
    // This step will execute in parallel with alpha analyzer
    step('parallel-analyzer-beta', async (ctx: StepContext): Promise<StepResult<AnalysisResult>> => {
      console.log('\n📊 Step 5: Parallel Analyzer Beta');
      console.log('═'.repeat(50));

      try {
        // Get data from transform step
        const transformResult = ctx.prevResults['transform-step'] as any;
        if (!transformResult || !transformResult.success) {
          const errorMsg = transformResult?.error || 'No data from transform';
          console.error(`  ❌ Cannot analyze: ${errorMsg}`);
          return {
            success: false,
            error: `Cannot analyze: ${errorMsg}`,
          };
        }

        const transformedData = transformResult.data as TransformedDataItem[];
        const startTime = Date.now();

        // Process second half
        const midpoint = Math.floor(transformedData.length / 2);
        const subset = transformedData.slice(midpoint);

        console.log(`  📥 Analyzing second half: ${subset.length} items (${midpoint} to ${transformedData.length - 1})`);

        // Simulate processing time (3 seconds)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Calculate statistics
        const values = subset.map(item => item.value);
        const scores = subset.map(item => item.score);
        const categories: Record<string, number> = {};

        subset.forEach(item => {
          categories[item.category] = (categories[item.category] || 0) + 1;
        });

        const duration = Date.now() - startTime;

        const result: AnalysisResult = {
          subset: 'beta',
          itemCount: subset.length,
          statistics: {
            min: Math.min(...values),
            max: Math.max(...values),
            average: values.reduce((a, b) => a + b, 0) / values.length,
            sum: values.reduce((a, b) => a + b, 0),
            scoreAverage: scores.reduce((a, b) => a + b, 0) / scores.length,
          },
          categories,
          processingTime: duration,
        };

        console.log(`  ✅ Analysis complete`);
        console.log(`  📈 Min: ${result.statistics.min}, Max: ${result.statistics.max}, Avg: ${result.statistics.average.toFixed(2)}`);
        console.log(`  ⏱️  Processing Time: ${duration}ms`);

        return {
          success: true,
          data: result,
        };
      } catch (error: any) {
        console.error(`  ❌ Analysis error:`, error.message);
        return {
          success: false,
          error: `Analysis failed: ${error.message}`,
        };
      }
    }, {
      dependsOn: ['transform-step'], // Only depends on transform-step, can run in parallel with alpha
    }),

    // Step 6: Merge Analysis - Combine results from both analyzers
    // Waits for both parallel analyzers to complete
    step('merge-analysis', async (ctx: StepContext): Promise<StepResult<MergedAnalysisResult>> => {
      console.log('\n🔀 Step 6: Merge Analysis');
      console.log('═'.repeat(50));

      try {
        // Get results from both analyzers
        const alphaResult = ctx.prevResults['parallel-analyzer-alpha'] as any;
        const betaResult = ctx.prevResults['parallel-analyzer-beta'] as any;

        if (!alphaResult?.success || !betaResult?.success) {
          const errorMsg = 'One or more analyzers failed';
          console.error(`  ❌ Cannot merge: ${errorMsg}`);
          return {
            success: false,
            error: `Cannot merge: ${errorMsg}`,
          };
        }

        const alpha = alphaResult.data as AnalysisResult;
        const beta = betaResult.data as AnalysisResult;

        console.log(`  📥 Merging results from alpha (${alpha.itemCount} items) and beta (${beta.itemCount} items)`);

        // Calculate global statistics
        const totalItems = alpha.itemCount + beta.itemCount;
        const globalMin = Math.min(alpha.statistics.min, beta.statistics.min);
        const globalMax = Math.max(alpha.statistics.max, beta.statistics.max);
        const globalSum = alpha.statistics.sum + beta.statistics.sum;
        const globalAverage = globalSum / totalItems;

        const globalScoreSum = (alpha.statistics.scoreAverage * alpha.itemCount) + (beta.statistics.scoreAverage * beta.itemCount);
        const globalScoreAverage = globalScoreSum / totalItems;

        // Merge category distributions
        const categoryDistribution: Record<string, number> = { ...alpha.categories };
        Object.entries(beta.categories).forEach(([cat, count]) => {
          categoryDistribution[cat] = (categoryDistribution[cat] || 0) + count;
        });

        // Calculate performance metrics
        const parallelProcessingTime = Math.max(alpha.processingTime, beta.processingTime);
        const estimatedSequentialTime = alpha.processingTime + beta.processingTime;
        const timeSaved = estimatedSequentialTime - parallelProcessingTime;
        const efficiency = (timeSaved / estimatedSequentialTime) * 100;

        const result: MergedAnalysisResult = {
          totalItems,
          globalStatistics: {
            min: globalMin,
            max: globalMax,
            average: globalAverage,
            sum: globalSum,
            scoreAverage: globalScoreAverage,
          },
          subsetComparison: {
            alpha,
            beta,
          },
          categoryDistribution,
          performanceMetrics: {
            parallelProcessingTime,
            estimatedSequentialTime,
            timeSaved,
            efficiency,
          },
        };

        console.log(`  ✅ Merge complete`);
        console.log(`  📊 Total Items: ${totalItems}`);
        console.log(`  📈 Global Stats - Min: ${globalMin}, Max: ${globalMax}, Avg: ${globalAverage.toFixed(2)}`);
        console.log(`  ⚡ Parallel Time: ${parallelProcessingTime}ms vs Sequential: ${estimatedSequentialTime}ms`);
        console.log(`  🎯 Time Saved: ${timeSaved}ms (${efficiency.toFixed(1)}% efficiency)`);

        return {
          success: true,
          data: result,
        };
      } catch (error: any) {
        console.error(`  ❌ Merge error:`, error.message);
        return {
          success: false,
          error: `Merge failed: ${error.message}`,
        };
      }
    }, {
      dependsOn: ['parallel-analyzer-alpha', 'parallel-analyzer-beta'], // Waits for both analyzers
    }),
  ],
});
