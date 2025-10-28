/**
 * Mock Slow API Service
 * Simulates a slow HTTP API with configurable delays and failure injection
 */

import { randomUUID } from 'crypto';
import type { StepResult, StepContext } from '../core/types.js';

/**
 * Configuration for the mock slow API
 */
export interface MockSlowAPIConfig {
  /** Delay in milliseconds before response */
  delay: number;

  /** Whether the request should fail */
  shouldFail?: boolean;

  /** Probability of failure (0-1). Takes precedence over shouldFail if provided */
  failureRate?: number;
}

/**
 * Mock API response data
 */
export interface MockSlowAPIData {
  /** Unique request identifier */
  requestId: string;

  /** Actual processing time in milliseconds */
  processingTime: number;

  /** Timestamp when the request completed */
  completedAt: Date;

  /** Configuration used for this request */
  config: MockSlowAPIConfig;
}

/**
 * Context for mock slow API step
 */
export interface MockSlowAPIContext extends StepContext {
  config?: MockSlowAPIConfig;
  metadata?: {
    config?: MockSlowAPIConfig;
  };
}

/**
 * Mock Slow API Handler
 *
 * Simulates a slow HTTP API with configurable delays and failure injection.
 * Uses failureRate for probabilistic failures, or shouldFail for deterministic failures.
 *
 * @param context - Step context containing API configuration
 * @returns StepResult with API response data or error
 *
 * @example
 * ```typescript
 * // 2 second delay with 30% failure rate
 * const result = await mockSlowAPI({
 *   runId: 'run-123',
 *   pipelineId: 'pipeline-123',
 *   prevResults: {},
 *   metadata: {
 *     config: { delay: 2000, failureRate: 0.3 }
 *   }
 * });
 * ```
 */
export async function mockSlowAPI(
  context: MockSlowAPIContext
): Promise<StepResult<MockSlowAPIData>> {
  try {
    // Get config from context
    const config = context.metadata?.config || context.config;

    if (!config) {
      return {
        success: false,
        error: 'No config provided in context.metadata.config or context.config',
      };
    }

    const { delay, shouldFail, failureRate } = config;

    // Validate delay
    if (typeof delay !== 'number' || delay < 0) {
      return {
        success: false,
        error: 'Invalid delay: must be a non-negative number',
      };
    }

    // Validate failureRate if provided
    if (failureRate !== undefined && (typeof failureRate !== 'number' || failureRate < 0 || failureRate > 1)) {
      return {
        success: false,
        error: 'Invalid failureRate: must be a number between 0 and 1',
      };
    }

    const requestId = randomUUID();
    const startTime = Date.now();

    console.log(`🐌 Mock Slow API: Starting request ${requestId} (delay: ${delay}ms)`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, delay));

    const processingTime = Date.now() - startTime;
    const completedAt = new Date();

    // Determine if request should fail
    let shouldRequestFail = false;

    if (failureRate !== undefined) {
      // Use probabilistic failure
      shouldRequestFail = Math.random() < failureRate;
    } else if (shouldFail !== undefined) {
      // Use deterministic failure
      shouldRequestFail = shouldFail;
    }

    if (shouldRequestFail) {
      console.log(`❌ Mock Slow API: Request ${requestId} failed after ${processingTime}ms`);
      return {
        success: false,
        error: `Mock API request failed (simulated failure)`,
      };
    }

    const data: MockSlowAPIData = {
      requestId,
      processingTime,
      completedAt,
      config,
    };

    console.log(`✅ Mock Slow API: Request ${requestId} completed in ${processingTime}ms`);

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error(`❌ Mock Slow API error:`, error.message);
    return {
      success: false,
      error: `Mock Slow API failed: ${error.message}`,
    };
  }
}

export default mockSlowAPI;
