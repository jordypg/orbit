/**
 * Error Recovery Demo Pipeline Integration Tests
 *
 * Tests for the error recovery demonstration pipeline including:
 * - Primary source success path with enhancement
 * - Fallback to baseline when primary fails
 * - Conditional enhancement logic
 * - Data validation regardless of path taken
 */

import { describe, it, expect } from '@jest/globals';
import { PipelineExecutor } from '../../src/core/executor.js';
import errorRecoveryPipeline from '../../src/pipelines/error-recovery-demo.js';
import type { FallbackResult, EnhancedDataResult, ValidationResult } from '../../src/pipelines/error-recovery-demo.js';
import type { StepResult } from '../../src/core/types.js';

describe('Error Recovery Demo Pipeline', () => {
  describe('Primary Source Success Path', () => {
    it('should use primary data when primary source succeeds (failureRate: 0)', async () => {
      console.log('\n🧪 TEST: Primary Source Success - Full Pipeline\n');

      const executor = new PipelineExecutor(errorRecoveryPipeline);

      // Force primary to succeed
      const result = await executor.execute({
        metadata: {
          failureRate: 0.0, // 0% failure rate - always succeed
        },
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify all steps completed
      const stepResults = result.stepResults || {};
      expect(Object.keys(stepResults).length).toBe(5);

      console.log(`\n✅ All ${Object.keys(stepResults).length} steps completed\n`);
    }, 10000);

    it('should apply enhancement when using primary data', async () => {
      console.log('\n🧪 TEST: Enhancement Applied to Primary Data\n');

      const executor = new PipelineExecutor(errorRecoveryPipeline);

      const result = await executor.execute({
        metadata: {
          failureRate: 0.0, // Force primary to succeed
        },
      });

      expect(result.success).toBe(true);

      // Check fallback handler chose primary
      const fallbackResult = result.stepResults?.['fallback-handler'] as StepResult<FallbackResult>;
      expect(fallbackResult?.success).toBe(true);
      expect(fallbackResult?.data?.selectedSource).toBe('primary');
      expect(fallbackResult?.data?.primarySucceeded).toBe(true);
      expect(fallbackResult?.data?.usedFallback).toBe(false);

      // Check enhancement was applied
      const enhancementResult = result.stepResults?.['conditional-enhancement'] as StepResult<EnhancedDataResult>;
      expect(enhancementResult?.success).toBe(true);
      expect(enhancementResult?.data?.enhancementApplied).toBe(true);
      expect(enhancementResult?.data?.enhancedValue).toBeDefined();
      expect(enhancementResult?.data?.qualityUpgrade).toBe('premium');

      // Verify enhanced value is 20% more than original
      const originalValue = enhancementResult.data!.originalValue;
      const enhancedValue = enhancementResult.data!.enhancedValue!;
      expect(enhancedValue).toBeCloseTo(originalValue * 1.2, 2);

      console.log(`  ✅ Primary data source selected`);
      console.log(`  ✅ Enhancement applied: ${originalValue} → ${enhancedValue}`);
    }, 10000);

    it('should validate primary data successfully', async () => {
      console.log('\n🧪 TEST: Primary Data Validation\n');

      const executor = new PipelineExecutor(errorRecoveryPipeline);

      const result = await executor.execute({
        metadata: {
          failureRate: 0.0,
        },
      });

      const validationResult = result.stepResults?.['final-validation'] as StepResult<ValidationResult>;
      expect(validationResult?.success).toBe(true);
      expect(validationResult?.data?.dataSource).toBe('primary');
      expect(validationResult?.data?.enhancementApplied).toBe(true);
      expect(validationResult?.data?.isValid).toBe(true);

      // All validation checks should pass
      const checks = validationResult.data!.checks;
      expect(checks.hasId).toBe(true);
      expect(checks.hasValue).toBe(true);
      expect(checks.hasQuality).toBe(true);
      expect(checks.valueInRange).toBe(true);

      console.log(`  ✅ Data source: ${validationResult.data!.dataSource}`);
      console.log(`  ✅ All validation checks passed`);
    }, 10000);
  });

  describe('Fallback to Baseline Path', () => {
    it('should use baseline data when primary source fails (failureRate: 1)', async () => {
      console.log('\n🧪 TEST: Fallback to Baseline - Full Pipeline\n');

      const executor = new PipelineExecutor(errorRecoveryPipeline);

      // Force primary to fail
      const result = await executor.execute({
        metadata: {
          failureRate: 1.0, // 100% failure rate - always fail
        },
      });

      // Pipeline should still succeed (using fallback)
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify all steps completed
      const stepResults = result.stepResults || {};
      expect(Object.keys(stepResults).length).toBe(5);

      console.log(`\n✅ All ${Object.keys(stepResults).length} steps completed using fallback\n`);
    }, 10000);

    it('should skip enhancement when using baseline data', async () => {
      console.log('\n🧪 TEST: Enhancement Skipped for Baseline Data\n');

      const executor = new PipelineExecutor(errorRecoveryPipeline);

      const result = await executor.execute({
        metadata: {
          failureRate: 1.0, // Force primary to fail
        },
      });

      expect(result.success).toBe(true);

      // Check fallback handler chose baseline
      const fallbackResult = result.stepResults?.['fallback-handler'] as StepResult<FallbackResult>;
      expect(fallbackResult?.success).toBe(true);
      expect(fallbackResult?.data?.selectedSource).toBe('baseline');
      expect(fallbackResult?.data?.primarySucceeded).toBe(false);
      expect(fallbackResult?.data?.usedFallback).toBe(true);

      // Check enhancement was skipped
      const enhancementResult = result.stepResults?.['conditional-enhancement'] as StepResult<EnhancedDataResult>;
      expect(enhancementResult?.success).toBe(true);
      expect(enhancementResult?.data?.enhancementApplied).toBe(false);
      expect(enhancementResult?.data?.enhancedValue).toBeUndefined();
      expect(enhancementResult?.data?.qualityUpgrade).toBeUndefined();

      console.log(`  ✅ Baseline data source selected`);
      console.log(`  ✅ Enhancement correctly skipped`);
    }, 10000);

    it('should validate baseline data successfully', async () => {
      console.log('\n🧪 TEST: Baseline Data Validation\n');

      const executor = new PipelineExecutor(errorRecoveryPipeline);

      const result = await executor.execute({
        metadata: {
          failureRate: 1.0,
        },
      });

      const validationResult = result.stepResults?.['final-validation'] as StepResult<ValidationResult>;
      expect(validationResult?.success).toBe(true);
      expect(validationResult?.data?.dataSource).toBe('baseline');
      expect(validationResult?.data?.enhancementApplied).toBe(false);
      expect(validationResult?.data?.isValid).toBe(true);

      // All validation checks should pass
      const checks = validationResult.data!.checks;
      expect(checks.hasId).toBe(true);
      expect(checks.hasValue).toBe(true);
      expect(checks.hasQuality).toBe(true);
      expect(checks.valueInRange).toBe(true);

      console.log(`  ✅ Data source: ${validationResult.data!.dataSource}`);
      console.log(`  ✅ All validation checks passed`);
    }, 10000);
  });

  describe('Probabilistic Behavior', () => {
    it('should handle random primary failures gracefully (default failureRate: 0.5)', async () => {
      console.log('\n🧪 TEST: Random Failure Handling (50% failure rate)\n');

      const executor = new PipelineExecutor(errorRecoveryPipeline);

      // Run with default 50% failure rate - outcome is random but should always succeed
      const result = await executor.execute({
        metadata: {
          // Use default failureRate: 0.5
        },
      });

      // Pipeline must succeed regardless of which path was taken
      expect(result.success).toBe(true);

      const fallbackResult = result.stepResults?.['fallback-handler'] as StepResult<FallbackResult>;
      const validationResult = result.stepResults?.['final-validation'] as StepResult<ValidationResult>;

      expect(fallbackResult?.success).toBe(true);
      expect(validationResult?.success).toBe(true);
      expect(validationResult?.data?.isValid).toBe(true);

      const source = fallbackResult?.data?.selectedSource;
      console.log(`  ✅ Pipeline succeeded using ${source?.toUpperCase()} data source`);
      console.log(`  ✅ Validation passed`);
    }, 10000);

    it('should demonstrate resilience across multiple runs', async () => {
      console.log('\n🧪 TEST: Resilience Across Multiple Runs\n');

      const executor = new PipelineExecutor(errorRecoveryPipeline);

      let primarySuccesses = 0;
      let baselineFallbacks = 0;
      const runs = 5;

      for (let i = 0; i < runs; i++) {
        const result = await executor.execute({
          metadata: {
            failureRate: 0.5, // 50% chance of failure
          },
        });

        expect(result.success).toBe(true);

        const fallbackResult = result.stepResults?.['fallback-handler'] as StepResult<FallbackResult>;

        if (fallbackResult?.data?.selectedSource === 'primary') {
          primarySuccesses++;
        } else {
          baselineFallbacks++;
        }
      }

      console.log(`  ✅ Completed ${runs} runs successfully`);
      console.log(`     Primary successes: ${primarySuccesses}`);
      console.log(`     Baseline fallbacks: ${baselineFallbacks}`);
      console.log(`  ✅ 100% pipeline success rate despite random failures`);

      // All runs should have succeeded
      expect(primarySuccesses + baselineFallbacks).toBe(runs);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle primary source failure gracefully', async () => {
      console.log('\n🧪 TEST: Graceful Primary Source Failure\n');

      const executor = new PipelineExecutor(errorRecoveryPipeline);

      const result = await executor.execute({
        metadata: {
          failureRate: 1.0, // Force failure
        },
      });

      // Primary step returns success but with null data and error message
      const primaryResult = result.stepResults?.['risky-primary-source'];
      expect(primaryResult?.success).toBe(true); // Step succeeds to allow pipeline to continue
      expect(primaryResult?.data).toBeNull(); // But data is null
      expect(primaryResult?.error).toContain('failed');

      // Pipeline overall succeeds thanks to fallback
      expect(result.success).toBe(true);

      console.log(`  ✅ Primary source failed (data is null)`);
      console.log(`  ✅ Pipeline succeeded using fallback`);
    }, 10000);

    it('should maintain data integrity in both success and fallback paths', async () => {
      console.log('\n🧪 TEST: Data Integrity in Both Paths\n');

      const executor = new PipelineExecutor(errorRecoveryPipeline);

      // Test primary path
      const primaryResult = await executor.execute({
        metadata: { failureRate: 0.0 },
      });

      const primaryValidation = primaryResult.stepResults?.['final-validation'] as StepResult<ValidationResult>;
      expect(primaryValidation?.data?.isValid).toBe(true);

      // Test fallback path
      const fallbackResult = await executor.execute({
        metadata: { failureRate: 1.0 },
      });

      const fallbackValidation = fallbackResult.stepResults?.['final-validation'] as StepResult<ValidationResult>;
      expect(fallbackValidation?.data?.isValid).toBe(true);

      console.log(`  ✅ Primary path: Data integrity maintained`);
      console.log(`  ✅ Fallback path: Data integrity maintained`);
    }, 15000);
  });
});
