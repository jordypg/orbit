/**
 * Async & Timing Demo Pipeline
 *
 * Demonstrates and tests the framework's handling of:
 * - Asynchronous operations with varying delays
 * - Configurable time delays (instant, medium, slow)
 * - Timeout enforcement and error handling
 * - Timing accuracy and validation
 *
 * This pipeline showcases:
 * - Sequential execution with different delay profiles
 * - Timeout configuration and enforcement
 * - Timing analysis and validation
 * - Retry mechanisms for timeout scenarios
 */

import { definePipeline, step } from '../core/index.js';
import { mockSlowAPI } from '../services/mock-slow-api.js';
import type { StepContext, StepResult } from '../core/types.js';
import type { MockSlowAPIData } from '../services/mock-slow-api.js';

/**
 * Timing summary data structure
 */
export interface TimingSummary {
    totalDuration: number;
    stepTimings: {
        name: string;
        expectedDelay: number;
        actualDelay: number;
        withinTolerance: boolean;
        tolerance: number;
    }[];
    allStepsValid: boolean;
    performanceMetrics: {
        overhead: number;
        efficiency: number; // percentage
    };
}

export default definePipeline({
    name: 'async-timing-demo',
    description: 'Async operations, configurable delays, and timeout enforcement',

    steps: [
        // Step 1: Slow Step - 5000ms delay
        step(
            'slow-step',
            async (ctx: StepContext): Promise<StepResult<MockSlowAPIData>> => {
                console.log('\n⏱️  Step 1: Slow Step (5000ms)');
                console.log('═'.repeat(50));

                const result = await mockSlowAPI({
                    ...ctx,
                    metadata: {
                        config: {
                            delay: 5000,
                            shouldFail: false,
                        },
                    },
                });

                if (result.success) {
                    console.log(`  ✅ Completed in ${result.data?.processingTime}ms`);
                }

                return result;
            }
        ),

        // Step 2: Medium Step - 2000ms delay
        step(
            'medium-step',
            async (ctx: StepContext): Promise<StepResult<MockSlowAPIData>> => {
                console.log('\n⏱️  Step 2: Medium Step (2000ms)');
                console.log('═'.repeat(50));

                const result = await mockSlowAPI({
                    ...ctx,
                    metadata: {
                        config: {
                            delay: 2000,
                            shouldFail: false,
                        },
                    },
                });

                if (result.success) {
                    console.log(`  ✅ Completed in ${result.data?.processingTime}ms`);
                }

                return result;
            }
        ),

        // Step 3: Instant Step - Near 0ms delay
        step(
            'instant-step',
            async (_ctx: StepContext): Promise<StepResult<{ completedAt: Date; processingTime: number }>> => {
                console.log('\n⚡ Step 3: Instant Step (~0ms)');
                console.log('═'.repeat(50));

                const startTime = Date.now();

                // Simulate minimal async work
                await Promise.resolve();

                const processingTime = Date.now() - startTime;
                const completedAt = new Date();

                console.log(`  ✅ Completed in ${processingTime}ms`);

                return {
                    success: true,
                    data: {
                        completedAt,
                        processingTime,
                    },
                };
            }
        ),

        // Step 4: Timeout Test - 3000ms delay (configurable timeout)
        step(
            'timeout-test',
            async (ctx: StepContext): Promise<StepResult<MockSlowAPIData>> => {
                console.log('\n⏱️  Step 4: Timeout Test (3000ms)');
                console.log('═'.repeat(50));

                const result = await mockSlowAPI({
                    ...ctx,
                    metadata: {
                        config: {
                            delay: 3000,
                            shouldFail: false,
                        },
                    },
                });

                if (result.success) {
                    console.log(`  ✅ Completed in ${result.data?.processingTime}ms`);
                }

                return result;
            }
        ),

        // Step 5: Timing Summary - Validate execution times
        step(
            'timing-summary',
            async (ctx: StepContext): Promise<StepResult<TimingSummary>> => {
                console.log('\n📊 Step 5: Timing Summary');
                console.log('═'.repeat(50));

                try {
                    const slowStep = ctx.prevResults['slow-step'] as StepResult<MockSlowAPIData>;
                    const mediumStep = ctx.prevResults['medium-step'] as StepResult<MockSlowAPIData>;
                    const instantStep = ctx.prevResults['instant-step'] as StepResult<{ completedAt: Date; processingTime: number }>;
                    const timeoutTest = ctx.prevResults['timeout-test'] as StepResult<MockSlowAPIData>;

                    // Define expected delays and tolerances (in ms)
                    const tolerance = 200; // 200ms tolerance for timing variations
                    const expectedTimings = [
                        { name: 'slow-step', expectedDelay: 5000, actualDelay: slowStep.data?.processingTime || 0 },
                        { name: 'medium-step', expectedDelay: 2000, actualDelay: mediumStep.data?.processingTime || 0 },
                        { name: 'instant-step', expectedDelay: 0, actualDelay: instantStep.data?.processingTime || 0 },
                        { name: 'timeout-test', expectedDelay: 3000, actualDelay: timeoutTest.data?.processingTime || 0 },
                    ];

                    // Validate each step's timing
                    const stepTimings = expectedTimings.map(({ name, expectedDelay, actualDelay }) => {
                        const diff = Math.abs(actualDelay - expectedDelay);
                        const withinTolerance = diff <= tolerance;

                        console.log(
                            `  ${withinTolerance ? '✅' : '❌'} ${name}: expected ${expectedDelay}ms, actual ${actualDelay}ms (diff: ${diff}ms)`
                        );

                        return {
                            name,
                            expectedDelay,
                            actualDelay,
                            withinTolerance,
                            tolerance,
                        };
                    });

                    // Calculate total duration
                    const totalDuration = expectedTimings.reduce((sum, timing) => sum + timing.actualDelay, 0);
                    const expectedTotalDuration = 10000; // 5000 + 2000 + 0 + 3000
                    const overhead = totalDuration - expectedTotalDuration;
                    const efficiency = (expectedTotalDuration / totalDuration) * 100;

                    const allStepsValid = stepTimings.every(timing => timing.withinTolerance);

                    console.log(`\n  📈 Performance Metrics:`);
                    console.log(`     Total Duration: ${totalDuration}ms`);
                    console.log(`     Expected Duration: ${expectedTotalDuration}ms`);
                    console.log(`     Overhead: ${overhead}ms`);
                    console.log(`     Efficiency: ${efficiency.toFixed(2)}%`);
                    console.log(`\n  ${allStepsValid ? '✅' : '❌'} All steps within tolerance: ${allStepsValid}`);

                    const summary: TimingSummary = {
                        totalDuration,
                        stepTimings,
                        allStepsValid,
                        performanceMetrics: {
                            overhead,
                            efficiency,
                        },
                    };

                    return {
                        success: true,
                        data: summary,
                    };
                } catch (error: any) {
                    console.error(`  ❌ Timing Summary error:`, error.message);
                    return {
                        success: false,
                        error: `Timing summary failed: ${error.message}`,
                    };
                }
            }
        ),
    ],
});
