/**
 * Unit tests for Mock Rate-Limited API Service
 * Tests sliding window rate limiting, identifier tracking, and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  mockRateLimitedAPI,
  clearRateLimitState,
  getRateLimitState,
  type MockRateLimitedAPIContext,
} from '../../src/services/mock-rate-limited-api.js';

describe('Mock Rate-Limited API Service', () => {
  // Clear state before and after each test
  beforeEach(() => {
    clearRateLimitState();
  });

  afterEach(() => {
    clearRateLimitState();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests up to the limit', async () => {
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 3,
            windowMs: 1000,
            identifier: 'user-123',
          },
        },
      };

      // First 3 calls should succeed
      const result1 = await mockRateLimitedAPI(context);
      expect(result1.success).toBe(true);
      expect(result1.data?.callsInWindow).toBe(1);
      expect(result1.data?.remainingCalls).toBe(2);

      const result2 = await mockRateLimitedAPI(context);
      expect(result2.success).toBe(true);
      expect(result2.data?.callsInWindow).toBe(2);
      expect(result2.data?.remainingCalls).toBe(1);

      const result3 = await mockRateLimitedAPI(context);
      expect(result3.success).toBe(true);
      expect(result3.data?.callsInWindow).toBe(3);
      expect(result3.data?.remainingCalls).toBe(0);
    });

    it('should reject the 4th call when limit is 3', async () => {
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 3,
            windowMs: 1000,
            identifier: 'user-123',
          },
        },
      };

      // Make 3 successful calls
      await mockRateLimitedAPI(context);
      await mockRateLimitedAPI(context);
      await mockRateLimitedAPI(context);

      // 4th call should fail
      const result4 = await mockRateLimitedAPI(context);
      expect(result4.success).toBe(false);
      expect(result4.error).toContain('Rate limit exceeded');
      expect(result4.data?.callsInWindow).toBe(3);
      expect(result4.data?.remainingCalls).toBe(0);
      expect(result4.data?.resetAt).toBeDefined();
    });

    it('should allow subsequent call after windowMs has passed', async () => {
      const windowMs = 100; // Short window for testing
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 3,
            windowMs,
            identifier: 'user-123',
          },
        },
      };

      // Make 3 successful calls
      await mockRateLimitedAPI(context);
      await mockRateLimitedAPI(context);
      await mockRateLimitedAPI(context);

      // 4th call should fail
      const result4 = await mockRateLimitedAPI(context);
      expect(result4.success).toBe(false);

      // Wait for window to pass
      await new Promise(resolve => setTimeout(resolve, windowMs + 50));

      // Next call should succeed as window has reset
      const result5 = await mockRateLimitedAPI(context);
      expect(result5.success).toBe(true);
      expect(result5.data?.callsInWindow).toBe(1);
    });
  });

  describe('Sliding Window Behavior', () => {
    it('should implement sliding window correctly', async () => {
      const windowMs = 200;
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 2,
            windowMs,
            identifier: 'user-123',
          },
        },
      };

      // First call at t=0
      const result1 = await mockRateLimitedAPI(context);
      expect(result1.success).toBe(true);

      // Wait 100ms
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second call at t=100 (within window)
      const result2 = await mockRateLimitedAPI(context);
      expect(result2.success).toBe(true);

      // Third call at t=100 should fail (2 calls in window)
      const result3 = await mockRateLimitedAPI(context);
      expect(result3.success).toBe(false);

      // Wait another 150ms (total 250ms from first call)
      await new Promise(resolve => setTimeout(resolve, 150));

      // Fourth call at t=250 should succeed (first call has expired)
      const result4 = await mockRateLimitedAPI(context);
      expect(result4.success).toBe(true);
    });

    it('should correctly filter out old timestamps', async () => {
      const windowMs = 100;
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 2,
            windowMs,
            identifier: 'user-123',
          },
        },
      };

      // Make 2 calls
      await mockRateLimitedAPI(context);
      await mockRateLimitedAPI(context);

      // Verify state has 2 timestamps
      let state = getRateLimitState('user-123');
      expect(state?.length).toBe(2);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, windowMs + 50));

      // Make another call (should clean up old timestamps)
      await mockRateLimitedAPI(context);

      // State should only have 1 timestamp now
      state = getRateLimitState('user-123');
      expect(state?.length).toBe(1);
    });
  });

  describe('Multiple Identifier Tracking', () => {
    it('should track different identifiers separately', async () => {
      const config = {
        maxCalls: 2,
        windowMs: 1000,
      };

      const context1: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: { ...config, identifier: 'user-1' },
        },
      };

      const context2: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: { ...config, identifier: 'user-2' },
        },
      };

      // User 1: Make 2 calls (at limit)
      await mockRateLimitedAPI(context1);
      await mockRateLimitedAPI(context1);

      // User 1: 3rd call should fail
      const user1Result = await mockRateLimitedAPI(context1);
      expect(user1Result.success).toBe(false);

      // User 2: Should still be able to make calls
      const user2Result1 = await mockRateLimitedAPI(context2);
      expect(user2Result1.success).toBe(true);

      const user2Result2 = await mockRateLimitedAPI(context2);
      expect(user2Result2.success).toBe(true);

      // User 2: 3rd call should fail
      const user2Result3 = await mockRateLimitedAPI(context2);
      expect(user2Result3.success).toBe(false);
    });

    it('should handle 3 different identifiers independently', async () => {
      const identifiers = ['api-key-1', 'api-key-2', 'api-key-3'];
      const maxCalls = 3;

      for (const identifier of identifiers) {
        const context: MockRateLimitedAPIContext = {
          runId: 'test-run-id',
          pipelineId: 'test-pipeline-id',
          prevResults: {},
          metadata: {
            config: {
              maxCalls,
              windowMs: 1000,
              identifier,
            },
          },
        };

        // Each identifier should allow maxCalls
        for (let i = 0; i < maxCalls; i++) {
          const result = await mockRateLimitedAPI(context);
          expect(result.success).toBe(true);
          expect(result.data?.identifier).toBe(identifier);
        }

        // Next call should fail for this identifier
        const failResult = await mockRateLimitedAPI(context);
        expect(failResult.success).toBe(false);
      }

      // Verify all identifiers have their own state
      expect(getRateLimitState('api-key-1')?.length).toBe(3);
      expect(getRateLimitState('api-key-2')?.length).toBe(3);
      expect(getRateLimitState('api-key-3')?.length).toBe(3);
    });

    it('should use default identifier when not specified', async () => {
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 2,
            windowMs: 1000,
            // No identifier specified
          },
        },
      };

      const result = await mockRateLimitedAPI(context);

      expect(result.success).toBe(true);
      expect(result.data?.identifier).toBe('default');

      // Verify state is tracked under 'default'
      const state = getRateLimitState('default');
      expect(state).toBeDefined();
      expect(state?.length).toBe(1);
    });
  });

  describe('Reset Time Calculation', () => {
    it('should provide correct resetAt timestamp when rate limited', async () => {
      const windowMs = 1000;
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 2,
            windowMs,
            identifier: 'user-123',
          },
        },
      };

      const startTime = Date.now();

      // Make 2 calls
      await mockRateLimitedAPI(context);
      await mockRateLimitedAPI(context);

      // 3rd call should be rate limited
      const result = await mockRateLimitedAPI(context);

      expect(result.success).toBe(false);
      expect(result.data?.resetAt).toBeDefined();

      const resetTime = result.data?.resetAt?.getTime() || 0;
      const expectedResetTime = startTime + windowMs;

      // Reset time should be approximately startTime + windowMs
      expect(resetTime).toBeGreaterThanOrEqual(expectedResetTime - 50);
      expect(resetTime).toBeLessThanOrEqual(expectedResetTime + 50);
    });
  });

  describe('Optional Delay Feature', () => {
    it('should apply delay to successful requests', async () => {
      const delay = 100;
      const startTime = Date.now();

      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 5,
            windowMs: 1000,
            delay,
          },
        },
      };

      const result = await mockRateLimitedAPI(context);
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(delay);
      expect(elapsed).toBeLessThan(delay + 50);
    });

    it('should not delay rate-limited requests', async () => {
      const delay = 100;
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 1,
            windowMs: 1000,
            delay,
          },
        },
      };

      // First call succeeds with delay
      await mockRateLimitedAPI(context);

      // Second call should be rate limited immediately (no delay)
      const startTime = Date.now();
      const result = await mockRateLimitedAPI(context);
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(elapsed).toBeLessThan(50); // Should be nearly instant
    });
  });

  describe('Configuration Validation', () => {
    it('should fail when config is missing', async () => {
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {},
      };

      const result = await mockRateLimitedAPI(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No config provided');
    });

    it('should fail when maxCalls is invalid', async () => {
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 0,
            windowMs: 1000,
          },
        },
      };

      const result = await mockRateLimitedAPI(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid maxCalls');
    });

    it('should fail when maxCalls is negative', async () => {
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: -1,
            windowMs: 1000,
          },
        },
      };

      const result = await mockRateLimitedAPI(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid maxCalls');
    });

    it('should fail when windowMs is invalid', async () => {
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 5,
            windowMs: 0,
          },
        },
      };

      const result = await mockRateLimitedAPI(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid windowMs');
    });

    it('should accept config from context.config instead of metadata', async () => {
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        config: {
          maxCalls: 5,
          windowMs: 1000,
        },
      };

      const result = await mockRateLimitedAPI(context);

      expect(result.success).toBe(true);
    });
  });

  describe('State Management Utilities', () => {
    it('should clear state for specific identifier', async () => {
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 2,
            windowMs: 1000,
            identifier: 'user-123',
          },
        },
      };

      // Make some calls
      await mockRateLimitedAPI(context);
      await mockRateLimitedAPI(context);

      // Verify state exists
      expect(getRateLimitState('user-123')?.length).toBe(2);

      // Clear state for this identifier
      clearRateLimitState('user-123');

      // State should be gone
      expect(getRateLimitState('user-123')).toBeUndefined();
    });

    it('should clear all state when no identifier provided', async () => {
      // Create state for multiple identifiers
      for (const id of ['user-1', 'user-2', 'user-3']) {
        const context: MockRateLimitedAPIContext = {
          runId: 'test-run-id',
          pipelineId: 'test-pipeline-id',
          prevResults: {},
          metadata: {
            config: {
              maxCalls: 5,
              windowMs: 1000,
              identifier: id,
            },
          },
        };
        await mockRateLimitedAPI(context);
      }

      // Verify all states exist
      expect(getRateLimitState('user-1')).toBeDefined();
      expect(getRateLimitState('user-2')).toBeDefined();
      expect(getRateLimitState('user-3')).toBeDefined();

      // Clear all state
      clearRateLimitState();

      // All states should be gone
      expect(getRateLimitState('user-1')).toBeUndefined();
      expect(getRateLimitState('user-2')).toBeUndefined();
      expect(getRateLimitState('user-3')).toBeUndefined();
    });
  });

  describe('Response Data', () => {
    it('should include all required fields in success response', async () => {
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 5,
            windowMs: 1000,
            identifier: 'test-user',
          },
        },
      };

      const result = await mockRateLimitedAPI(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.requestId).toBeDefined();
      expect(result.data?.identifier).toBe('test-user');
      expect(result.data?.callsInWindow).toBe(1);
      expect(result.data?.maxCalls).toBe(5);
      expect(result.data?.remainingCalls).toBe(4);
      expect(result.data?.completedAt).toBeInstanceOf(Date);
      expect(result.data?.resetAt).toBeUndefined(); // No reset for successful calls
    });

    it('should include all required fields in failure response', async () => {
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 1,
            windowMs: 1000,
            identifier: 'test-user',
          },
        },
      };

      // First call succeeds
      await mockRateLimitedAPI(context);

      // Second call fails
      const result = await mockRateLimitedAPI(context);

      expect(result.success).toBe(false);
      expect(result.data).toBeDefined();
      expect(result.data?.requestId).toBeDefined();
      expect(result.data?.identifier).toBe('test-user');
      expect(result.data?.callsInWindow).toBe(1);
      expect(result.data?.maxCalls).toBe(1);
      expect(result.data?.remainingCalls).toBe(0);
      expect(result.data?.resetAt).toBeInstanceOf(Date);
      expect(result.data?.completedAt).toBeInstanceOf(Date);
    });

    it('should generate unique request IDs', async () => {
      const context: MockRateLimitedAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxCalls: 5,
            windowMs: 1000,
          },
        },
      };

      const result1 = await mockRateLimitedAPI(context);
      const result2 = await mockRateLimitedAPI(context);

      expect(result1.data?.requestId).not.toBe(result2.data?.requestId);
    });
  });
});
