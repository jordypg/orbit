/**
 * Error Recovery Demo Pipeline
 *
 * Demonstrates graceful error handling and recovery patterns:
 * - Risky primary data source with configurable failure rate
 * - Fallback to reliable baseline when primary fails
 * - Conditional enhancement based on data source used
 * - Final validation regardless of path taken
 *
 * This pipeline showcases:
 * - Try-catch error handling
 * - Fallback strategies
 * - Conditional step execution
 * - Data integrity validation
 */

import { definePipeline, step } from '../core/index.js';
import type { StepContext, StepResult } from '../core/types.js';

/**
 * Primary data source result
 */
export interface PrimaryDataResult {
  source: 'primary';
  data: {
    id: string;
    value: number;
    quality: 'high';
    timestamp: Date;
  };
  attemptedAt: Date;
}

/**
 * Baseline data source result
 */
export interface BaselineDataResult {
  source: 'baseline';
  data: {
    id: string;
    value: number;
    quality: 'standard';
    timestamp: Date;
  };
  attemptedAt: Date;
}

/**
 * Fallback handler result
 */
export interface FallbackResult {
  selectedSource: 'primary' | 'baseline';
  data: any;
  primarySucceeded: boolean;
  usedFallback: boolean;
}

/**
 * Enhanced data result
 */
export interface EnhancedDataResult {
  enhancementApplied: boolean;
  originalValue: number;
  enhancedValue?: number;
  qualityUpgrade?: string;
}

/**
 * Final validation result
 */
export interface ValidationResult {
  dataSource: 'primary' | 'baseline';
  enhancementApplied: boolean;
  isValid: boolean;
  checks: {
    hasId: boolean;
    hasValue: boolean;
    hasQuality: boolean;
    valueInRange: boolean;
  };
}

/**
 * Simulates a risky primary data source with configurable failure rate
 */
async function riskyPrimarySource(failureRate: number): Promise<PrimaryDataResult> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Randomly fail based on failureRate
  const shouldFail = Math.random() < failureRate;

  if (shouldFail) {
    throw new Error(`Primary source failed (simulated failure, rate: ${failureRate})`);
  }

  return {
    source: 'primary',
    data: {
      id: `primary-${Date.now()}`,
      value: 100,
      quality: 'high',
      timestamp: new Date(),
    },
    attemptedAt: new Date(),
  };
}

/**
 * Reliable baseline data source (never fails)
 */
async function reliableBaseline(): Promise<BaselineDataResult> {
  // Simulate small delay
  await new Promise(resolve => setTimeout(resolve, 200));

  return {
    source: 'baseline',
    data: {
      id: `baseline-${Date.now()}`,
      value: 50, // Lower value than primary
      quality: 'standard',
      timestamp: new Date(),
    },
    attemptedAt: new Date(),
  };
}

export default definePipeline({
  name: 'error-recovery-demo',
  description: 'Demonstrates error handling, fallback strategies, and conditional execution',

  steps: [
    // Step 1: Risky Primary Source
    step(
      'risky-primary-source',
      async (ctx: StepContext): Promise<StepResult<PrimaryDataResult | null>> => {
        console.log('\n🎲 Step 1: Risky Primary Source');
        console.log('═'.repeat(50));

        // Get failure rate from metadata (default: 0.5)
        const failureRate = (ctx.metadata?.failureRate as number) ?? 0.5;

        console.log(`  Attempting primary source (failure rate: ${(failureRate * 100).toFixed(0)}%)...`);

        try {
          const result = await riskyPrimarySource(failureRate);
          console.log(`  ✅ Primary source succeeded! Value: ${result.data.value}`);

          return {
            success: true,
            data: result,
          };
        } catch (error: any) {
          console.log(`  ❌ Primary source failed: ${error.message}`);

          // Still return success to allow pipeline to continue
          // Fallback handler will check if data is null
          return {
            success: true,
            data: null,
            error: error.message,
          };
        }
      }
    ),

    // Step 2: Reliable Baseline (always runs as a safety net)
    step(
      'reliable-baseline',
      async (_ctx: StepContext): Promise<StepResult<BaselineDataResult>> => {
        console.log('\n🔒 Step 2: Reliable Baseline Source');
        console.log('═'.repeat(50));

        console.log(`  Fetching baseline data (always succeeds)...`);

        const result = await reliableBaseline();
        console.log(`  ✅ Baseline source succeeded! Value: ${result.data.value}`);

        return {
          success: true,
          data: result,
        };
      }
    ),

    // Step 3: Fallback Handler (chooses between primary and baseline)
    step(
      'fallback-handler',
      async (ctx: StepContext): Promise<StepResult<FallbackResult>> => {
        console.log('\n🔄 Step 3: Fallback Handler');
        console.log('═'.repeat(50));

        const primaryResult = ctx.prevResults['risky-primary-source'] as StepResult<PrimaryDataResult | null>;
        const baselineResult = ctx.prevResults['reliable-baseline'] as StepResult<BaselineDataResult>;

        if (!baselineResult?.success) {
          return {
            success: false,
            error: 'Baseline source failed (this should never happen)',
          };
        }

        let selectedSource: 'primary' | 'baseline';
        let data: any;
        // Primary succeeded if data is not null
        const primarySucceeded = primaryResult?.data !== null && primaryResult?.data !== undefined;

        if (primarySucceeded) {
          selectedSource = 'primary';
          data = primaryResult.data;
          console.log(`  ✅ Using PRIMARY data source (value: ${data.data.value})`);
        } else {
          selectedSource = 'baseline';
          data = baselineResult.data;
          console.log(`  ℹ️  Using BASELINE fallback (value: ${data.data.value})`);
        }

        const fallbackResult: FallbackResult = {
          selectedSource,
          data,
          primarySucceeded,
          usedFallback: !primarySucceeded,
        };

        return {
          success: true,
          data: fallbackResult,
        };
      }
    ),

    // Step 4: Conditional Enhancement (runs only if using primary data)
    step(
      'conditional-enhancement',
      async (ctx: StepContext): Promise<StepResult<EnhancedDataResult>> => {
        console.log('\n✨ Step 4: Conditional Enhancement');
        console.log('═'.repeat(50));

        const fallbackResult = ctx.prevResults['fallback-handler'] as StepResult<FallbackResult>;

        if (!fallbackResult?.success) {
          return {
            success: false,
            error: 'Fallback handler failed',
          };
        }

        const fallback = fallbackResult.data!;

        if (fallback.selectedSource === 'primary') {
          console.log(`  ✨ Applying enhancement to primary data...`);

          const originalValue = fallback.data.data.value;
          const enhancedValue = originalValue * 1.2; // 20% boost

          await new Promise(resolve => setTimeout(resolve, 300)); // Simulate processing

          console.log(`  ✅ Enhanced value: ${originalValue} → ${enhancedValue}`);

          return {
            success: true,
            data: {
              enhancementApplied: true,
              originalValue,
              enhancedValue,
              qualityUpgrade: 'premium',
            },
          };
        } else {
          console.log(`  ℹ️  Skipping enhancement (using baseline data)`);

          return {
            success: true,
            data: {
              enhancementApplied: false,
              originalValue: fallback.data.data.value,
            },
          };
        }
      }
    ),

    // Step 5: Final Validation (validates data integrity regardless of path)
    step(
      'final-validation',
      async (ctx: StepContext): Promise<StepResult<ValidationResult>> => {
        console.log('\n✅ Step 5: Final Validation');
        console.log('═'.repeat(50));

        const fallbackResult = ctx.prevResults['fallback-handler'] as StepResult<FallbackResult>;
        const enhancementResult = ctx.prevResults['conditional-enhancement'] as StepResult<EnhancedDataResult>;

        if (!fallbackResult?.success || !enhancementResult?.success) {
          return {
            success: false,
            error: 'Previous steps failed',
          };
        }

        const fallback = fallbackResult.data!;
        const enhancement = enhancementResult.data!;

        // Validate data integrity
        const data = fallback.data.data;
        const checks = {
          hasId: !!data.id,
          hasValue: typeof data.value === 'number',
          hasQuality: !!data.quality,
          valueInRange: data.value >= 0 && data.value <= 1000,
        };

        const isValid = Object.values(checks).every(check => check);

        console.log(`\n  📊 Validation Results:`);
        console.log(`     Data Source: ${fallback.selectedSource.toUpperCase()}`);
        console.log(`     Enhancement Applied: ${enhancement.enhancementApplied ? 'Yes' : 'No'}`);
        console.log(`     Has ID: ${checks.hasId ? '✅' : '❌'}`);
        console.log(`     Has Value: ${checks.hasValue ? '✅' : '❌'}`);
        console.log(`     Has Quality: ${checks.hasQuality ? '✅' : '❌'}`);
        console.log(`     Value in Range: ${checks.valueInRange ? '✅' : '❌'}`);
        console.log(`     Overall Valid: ${isValid ? '✅' : '❌'}`);

        const validationResult: ValidationResult = {
          dataSource: fallback.selectedSource,
          enhancementApplied: enhancement.enhancementApplied,
          isValid,
          checks,
        };

        return {
          success: true,
          data: validationResult,
        };
      }
    ),
  ],
});
