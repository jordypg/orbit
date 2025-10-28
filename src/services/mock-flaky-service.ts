/**
 * Mock Flaky Service
 * Simulates an unreliable service that fails a specific number of times before succeeding
 */

import { randomUUID } from 'crypto';
import type { StepResult, StepContext } from '../core/types.js';

/**
 * Configuration for the mock flaky service
 */
export interface MockFlakyServiceConfig {
  /** Number of failures before the service succeeds */
  failuresBeforeSuccess: number;

  /** Optional delay in milliseconds for each attempt */
  delay?: number;
}

/**
 * Flaky service response data
 */
export interface MockFlakyServiceData {
  /** Unique request identifier */
  requestId: string;

  /** Service name that was called */
  serviceName: string;

  /** Current attempt number (1-indexed) */
  attemptNumber: number;

  /** Total number of attempts made for this service */
  totalAttempts: number;

  /** Whether this attempt succeeded */
  succeeded: boolean;

  /** Timestamp when the attempt completed */
  completedAt: Date;

  /** Configuration used */
  config: MockFlakyServiceConfig;
}

/**
 * Context for mock flaky service step
 */
export interface MockFlakyServiceContext extends StepContext {
  serviceName?: string;
  config?: MockFlakyServiceConfig;
  metadata?: {
    serviceName?: string;
    config?: MockFlakyServiceConfig;
    attemptTracking?: Record<string, number>;
  };
}

/**
 * Mock Flaky Service Handler
 *
 * Simulates an unreliable service that fails a configured number of times
 * before succeeding. Tracks attempts in context.metadata.attemptTracking.
 *
 * @param context - Step context containing service name, config, and attempt tracking
 * @returns StepResult with service response data or error
 *
 * @example
 * ```typescript
 * // Service that fails twice before succeeding
 * const result = await mockFlakyService({
 *   runId: 'run-123',
 *   pipelineId: 'pipeline-123',
 *   prevResults: {},
 *   metadata: {
 *     serviceName: 'payment-api',
 *     config: { failuresBeforeSuccess: 2 },
 *     attemptTracking: {}
 *   }
 * });
 * ```
 */
export async function mockFlakyService(
  context: MockFlakyServiceContext
): Promise<StepResult<MockFlakyServiceData>> {
  try {
    // Get service name from context
    const serviceName = context.metadata?.serviceName || context.serviceName || 'default-service';

    // Get config from context
    const config = context.metadata?.config || context.config;

    if (!config) {
      return {
        success: false,
        error: 'No config provided in context.metadata.config or context.config',
      };
    }

    const { failuresBeforeSuccess, delay = 0 } = config;

    // Validate failuresBeforeSuccess
    if (typeof failuresBeforeSuccess !== 'number' || failuresBeforeSuccess < 0) {
      return {
        success: false,
        error: 'Invalid failuresBeforeSuccess: must be a non-negative number',
      };
    }

    // Initialize attemptTracking if not present
    if (!context.metadata) {
      context.metadata = {};
    }
    if (!context.metadata.attemptTracking) {
      context.metadata.attemptTracking = {};
    }

    // Get current attempt count for this service
    const currentAttempts = context.metadata.attemptTracking[serviceName] || 0;

    // Increment attempt counter
    const attemptNumber = currentAttempts + 1;
    context.metadata.attemptTracking[serviceName] = attemptNumber;

    const requestId = randomUUID();

    console.log(
      `🎲 Mock Flaky Service [${serviceName}]: Attempt ${attemptNumber} (needs ${failuresBeforeSuccess + 1} attempts to succeed)`
    );

    // Apply optional delay
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const completedAt = new Date();

    // Determine if this attempt should fail
    const shouldFail = attemptNumber <= failuresBeforeSuccess;

    const data: MockFlakyServiceData = {
      requestId,
      serviceName,
      attemptNumber,
      totalAttempts: attemptNumber,
      succeeded: !shouldFail,
      completedAt,
      config,
    };

    if (shouldFail) {
      console.log(
        `❌ Mock Flaky Service [${serviceName}]: Attempt ${attemptNumber} failed (expected failure)`
      );
      return {
        success: false,
        error: `Service [${serviceName}] failed on attempt ${attemptNumber}/${failuresBeforeSuccess + 1} (simulated failure)`,
        data,
      };
    }

    console.log(
      `✅ Mock Flaky Service [${serviceName}]: Attempt ${attemptNumber} succeeded after ${currentAttempts} previous failures`
    );

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error(`❌ Mock Flaky Service error:`, error.message);
    return {
      success: false,
      error: `Mock Flaky Service failed: ${error.message}`,
    };
  }
}

export default mockFlakyService;
