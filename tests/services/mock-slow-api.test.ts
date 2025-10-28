/**
 * Unit tests for Mock Slow API Service
 * Tests timing accuracy, failure injection, and configuration validation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { mockSlowAPI, type MockSlowAPIContext } from '../../src/services/mock-slow-api.js';

describe('Mock Slow API Service', () => {
  describe('Successful Response Scenarios', () => {
    it('should successfully complete with configured delay', async () => {
      const delay = 100;
      const startTime = Date.now();

      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            delay,
            shouldFail: false,
          },
        },
      };

      const result = await mockSlowAPI(context);
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.requestId).toBeDefined();
      expect(result.data?.processingTime).toBeGreaterThanOrEqual(delay);
      expect(result.data?.processingTime).toBeLessThan(delay + 100); // Allow 100ms tolerance
      expect(elapsed).toBeGreaterThanOrEqual(delay);
      expect(result.data?.completedAt).toBeInstanceOf(Date);
      expect(result.data?.config.delay).toBe(delay);
    });

    it('should handle zero delay', async () => {
      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            delay: 0,
          },
        },
      };

      const result = await mockSlowAPI(context);

      expect(result.success).toBe(true);
      expect(result.data?.processingTime).toBeLessThan(50);
    });

    it('should verify timing accuracy for various delays', async () => {
      const delays = [50, 100, 200, 500];
      const tolerance = 50; // 50ms tolerance

      for (const delay of delays) {
        const startTime = Date.now();

        const context: MockSlowAPIContext = {
          runId: 'test-run-id',
          pipelineId: 'test-pipeline-id',
          prevResults: {},
          metadata: {
            config: { delay },
          },
        };

        const result = await mockSlowAPI(context);
        const elapsed = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(elapsed).toBeGreaterThanOrEqual(delay);
        expect(elapsed).toBeLessThan(delay + tolerance);
        expect(result.data?.processingTime).toBeGreaterThanOrEqual(delay);
        expect(result.data?.processingTime).toBeLessThan(delay + tolerance);
      }
    });

    it('should accept config from context.config instead of metadata', async () => {
      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        config: {
          delay: 50,
        },
      };

      const result = await mockSlowAPI(context);

      expect(result.success).toBe(true);
      expect(result.data?.config.delay).toBe(50);
    });

    it('should generate unique request IDs', async () => {
      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: { delay: 10 },
        },
      };

      const result1 = await mockSlowAPI(context);
      const result2 = await mockSlowAPI(context);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data?.requestId).not.toBe(result2.data?.requestId);
    });
  });

  describe('Deterministic Failure (shouldFail)', () => {
    it('should fail when shouldFail is true', async () => {
      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            delay: 50,
            shouldFail: true,
          },
        },
      };

      const result = await mockSlowAPI(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('simulated failure');
    });

    it('should succeed when shouldFail is false', async () => {
      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            delay: 50,
            shouldFail: false,
          },
        },
      };

      const result = await mockSlowAPI(context);

      expect(result.success).toBe(true);
    });
  });

  describe('Probabilistic Failure (failureRate)', () => {
    it('should always fail with 100% failure rate', async () => {
      const attempts = 10;
      let failures = 0;

      for (let i = 0; i < attempts; i++) {
        const context: MockSlowAPIContext = {
          runId: 'test-run-id',
          pipelineId: 'test-pipeline-id',
          prevResults: {},
          metadata: {
            config: {
              delay: 10,
              failureRate: 1.0,
            },
          },
        };

        const result = await mockSlowAPI(context);
        if (!result.success) {
          failures++;
        }
      }

      expect(failures).toBe(attempts);
    });

    it('should never fail with 0% failure rate', async () => {
      const attempts = 10;
      let successes = 0;

      for (let i = 0; i < attempts; i++) {
        const context: MockSlowAPIContext = {
          runId: 'test-run-id',
          pipelineId: 'test-pipeline-id',
          prevResults: {},
          metadata: {
            config: {
              delay: 10,
              failureRate: 0.0,
            },
          },
        };

        const result = await mockSlowAPI(context);
        if (result.success) {
          successes++;
        }
      }

      expect(successes).toBe(attempts);
    });

    it('should approximate 30% failure rate over 1000 calls', async () => {
      const attempts = 1000;
      const expectedFailureRate = 0.3;
      const tolerance = 0.05; // ±5%
      let failures = 0;

      for (let i = 0; i < attempts; i++) {
        const context: MockSlowAPIContext = {
          runId: 'test-run-id',
          pipelineId: 'test-pipeline-id',
          prevResults: {},
          metadata: {
            config: {
              delay: 0, // No delay for speed
              failureRate: expectedFailureRate,
            },
          },
        };

        const result = await mockSlowAPI(context);
        if (!result.success) {
          failures++;
        }
      }

      const actualFailureRate = failures / attempts;
      const lowerBound = expectedFailureRate - tolerance;
      const upperBound = expectedFailureRate + tolerance;

      expect(actualFailureRate).toBeGreaterThanOrEqual(lowerBound);
      expect(actualFailureRate).toBeLessThanOrEqual(upperBound);
    });

    it('should prioritize failureRate over shouldFail', async () => {
      // Test that failureRate=0 succeeds even when shouldFail=true
      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            delay: 10,
            shouldFail: true,
            failureRate: 0.0,
          },
        },
      };

      const result = await mockSlowAPI(context);

      expect(result.success).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should fail when config is missing', async () => {
      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {},
      };

      const result = await mockSlowAPI(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No config provided');
    });

    it('should fail when delay is negative', async () => {
      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            delay: -100,
          },
        },
      };

      const result = await mockSlowAPI(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid delay');
    });

    it('should fail when delay is not a number', async () => {
      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            delay: 'invalid' as any,
          },
        },
      };

      const result = await mockSlowAPI(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid delay');
    });

    it('should fail when failureRate is negative', async () => {
      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            delay: 50,
            failureRate: -0.5,
          },
        },
      };

      const result = await mockSlowAPI(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid failureRate');
    });

    it('should fail when failureRate is greater than 1', async () => {
      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            delay: 50,
            failureRate: 1.5,
          },
        },
      };

      const result = await mockSlowAPI(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid failureRate');
    });

    it('should fail when failureRate is not a number', async () => {
      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            delay: 50,
            failureRate: 'invalid' as any,
          },
        },
      };

      const result = await mockSlowAPI(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid failureRate');
    });
  });

  describe('Edge Cases', () => {
    it('should handle large delays', async () => {
      const delay = 2000;
      const startTime = Date.now();

      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: { delay },
        },
      };

      const result = await mockSlowAPI(context);
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(delay);
    });

    it('should include config in response data', async () => {
      const config = {
        delay: 100,
        shouldFail: false,
      };

      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: { config },
      };

      const result = await mockSlowAPI(context);

      expect(result.success).toBe(true);
      expect(result.data?.config).toEqual(config);
    });

    it('should handle context with additional metadata fields', async () => {
      const context: MockSlowAPIContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: { delay: 50 },
          customField: 'custom-value',
          userId: 'user-123',
        },
      };

      const result = await mockSlowAPI(context);

      expect(result.success).toBe(true);
    });
  });
});
