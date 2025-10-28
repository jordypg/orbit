/**
 * Mock Rate-Limited API Service
 * Simulates an API with rate limiting based on sliding window algorithm
 */

import { randomUUID } from 'crypto';
import type { StepResult, StepContext } from '../core/types.js';

/**
 * Configuration for the mock rate-limited API
 */
export interface MockRateLimitedAPIConfig {
  /** Maximum number of calls allowed within the window */
  maxCalls: number;

  /** Time window in milliseconds */
  windowMs: number;

  /** Delay for successful requests in milliseconds */
  delay?: number;

  /** Identifier for rate limit tracking (e.g., API key, user ID) */
  identifier?: string;
}

/**
 * Rate limit response data
 */
export interface MockRateLimitedAPIData {
  /** Unique request identifier */
  requestId: string;

  /** Identifier used for rate limiting */
  identifier: string;

  /** Number of calls made within current window */
  callsInWindow: number;

  /** Maximum calls allowed */
  maxCalls: number;

  /** Remaining calls in current window */
  remainingCalls: number;

  /** Timestamp when the rate limit resets */
  resetAt?: Date;

  /** Timestamp when the request completed */
  completedAt: Date;
}

/**
 * Context for mock rate-limited API step
 */
export interface MockRateLimitedAPIContext extends StepContext {
  config?: MockRateLimitedAPIConfig;
  metadata?: {
    config?: MockRateLimitedAPIConfig;
  };
}

/**
 * Shared state for tracking rate limits across calls
 * Keyed by identifier, stores array of timestamps
 */
const rateLimitState: Record<string, number[]> = {};

/**
 * Mock Rate-Limited API Handler
 *
 * Simulates an API with rate limiting using a sliding window algorithm.
 * Tracks call timestamps per identifier and enforces rate limits.
 *
 * @param context - Step context containing rate limit configuration
 * @returns StepResult with API response data or rate limit error
 *
 * @example
 * ```typescript
 * // Allow 3 calls per 1000ms per identifier
 * const result = await mockRateLimitedAPI({
 *   runId: 'run-123',
 *   pipelineId: 'pipeline-123',
 *   prevResults: {},
 *   metadata: {
 *     config: {
 *       maxCalls: 3,
 *       windowMs: 1000,
 *       identifier: 'user-123'
 *     }
 *   }
 * });
 * ```
 */
export async function mockRateLimitedAPI(
  context: MockRateLimitedAPIContext
): Promise<StepResult<MockRateLimitedAPIData>> {
  try {
    // Get config from context
    const config = context.metadata?.config || context.config;

    if (!config) {
      return {
        success: false,
        error: 'No config provided in context.metadata.config or context.config',
      };
    }

    const { maxCalls, windowMs, delay = 0, identifier = 'default' } = config;

    // Validate configuration
    if (typeof maxCalls !== 'number' || maxCalls <= 0) {
      return {
        success: false,
        error: 'Invalid maxCalls: must be a positive number',
      };
    }

    if (typeof windowMs !== 'number' || windowMs <= 0) {
      return {
        success: false,
        error: 'Invalid windowMs: must be a positive number',
      };
    }

    const requestId = randomUUID();
    const now = Date.now();

    console.log(`🚦 Mock Rate-Limited API [${identifier}]: Request ${requestId}`);

    // Initialize state for this identifier if not present
    if (!rateLimitState[identifier]) {
      rateLimitState[identifier] = [];
    }

    // Filter out timestamps older than windowMs (sliding window)
    const windowStart = now - windowMs;
    rateLimitState[identifier] = rateLimitState[identifier].filter(
      timestamp => timestamp > windowStart
    );

    const callsInWindow = rateLimitState[identifier].length;
    const remainingCalls = Math.max(0, maxCalls - callsInWindow);

    console.log(
      `  📊 Calls in window: ${callsInWindow}/${maxCalls}, Remaining: ${remainingCalls}`
    );

    // Check if rate limit is exceeded
    if (callsInWindow >= maxCalls) {
      // Calculate when the oldest call will expire
      // Safe to use non-null assertion because callsInWindow >= maxCalls guarantees array has elements
      const oldestTimestamp = rateLimitState[identifier][0]!;
      const resetAt = new Date(oldestTimestamp + windowMs);

      console.log(`  ❌ Rate limit exceeded. Reset at: ${resetAt.toISOString()}`);

      const data: MockRateLimitedAPIData = {
        requestId,
        identifier,
        callsInWindow,
        maxCalls,
        remainingCalls: 0,
        resetAt,
        completedAt: new Date(),
      };

      return {
        success: false,
        error: `Rate limit exceeded for identifier [${identifier}]. Maximum ${maxCalls} calls per ${windowMs}ms. Reset at: ${resetAt.toISOString()}`,
        data,
      };
    }

    // Record this call
    rateLimitState[identifier].push(now);

    // Apply optional delay
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const completedAt = new Date();
    const data: MockRateLimitedAPIData = {
      requestId,
      identifier,
      callsInWindow: callsInWindow + 1,
      maxCalls,
      remainingCalls: remainingCalls - 1,
      completedAt,
    };

    console.log(`  ✅ Request successful. Remaining: ${data.remainingCalls}`);

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error(`❌ Mock Rate-Limited API error:`, error.message);
    return {
      success: false,
      error: `Mock Rate-Limited API failed: ${error.message}`,
    };
  }
}

/**
 * Clear rate limit state for a specific identifier or all identifiers
 * Useful for testing and cleanup
 *
 * @param identifier - Optional identifier to clear. If not provided, clears all state.
 */
export function clearRateLimitState(identifier?: string): void {
  if (identifier) {
    delete rateLimitState[identifier];
  } else {
    Object.keys(rateLimitState).forEach(key => {
      delete rateLimitState[key];
    });
  }
}

/**
 * Get current rate limit state for an identifier
 * Useful for testing and debugging
 *
 * @param identifier - Identifier to check
 * @returns Array of timestamps or undefined if no state exists
 */
export function getRateLimitState(identifier: string): number[] | undefined {
  return rateLimitState[identifier];
}

export default mockRateLimitedAPI;
