/**
 * Unit tests for Mock Flaky Service
 * Tests retry behavior, attempt tracking, and multiple service instances
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { mockFlakyService, type MockFlakyServiceContext } from '../../src/services/mock-flaky-service.js';

describe('Mock Flaky Service', () => {
  describe('Basic Failure and Success Scenarios', () => {
    it('should fail twice and succeed on third attempt', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          config: {
            failuresBeforeSuccess: 2,
          },
          attemptTracking: {},
        },
      };

      // First attempt - should fail
      const result1 = await mockFlakyService(context);
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('attempt 1');
      expect(result1.data?.attemptNumber).toBe(1);
      expect(result1.data?.succeeded).toBe(false);
      expect(context.metadata?.attemptTracking?.['test-service']).toBe(1);

      // Second attempt - should fail
      const result2 = await mockFlakyService(context);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('attempt 2');
      expect(result2.data?.attemptNumber).toBe(2);
      expect(result2.data?.succeeded).toBe(false);
      expect(context.metadata?.attemptTracking?.['test-service']).toBe(2);

      // Third attempt - should succeed
      const result3 = await mockFlakyService(context);
      expect(result3.success).toBe(true);
      expect(result3.data?.attemptNumber).toBe(3);
      expect(result3.data?.succeeded).toBe(true);
      expect(result3.data?.serviceName).toBe('test-service');
      expect(context.metadata?.attemptTracking?.['test-service']).toBe(3);
    });

    it('should succeed immediately when failuresBeforeSuccess is 0', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          config: {
            failuresBeforeSuccess: 0,
          },
          attemptTracking: {},
        },
      };

      const result = await mockFlakyService(context);

      expect(result.success).toBe(true);
      expect(result.data?.attemptNumber).toBe(1);
      expect(result.data?.succeeded).toBe(true);
    });

    it('should fail once and succeed on second attempt', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          config: {
            failuresBeforeSuccess: 1,
          },
          attemptTracking: {},
        },
      };

      // First attempt - should fail
      const result1 = await mockFlakyService(context);
      expect(result1.success).toBe(false);
      expect(result1.data?.attemptNumber).toBe(1);

      // Second attempt - should succeed
      const result2 = await mockFlakyService(context);
      expect(result2.success).toBe(true);
      expect(result2.data?.attemptNumber).toBe(2);
    });

    it('should handle many failures before success', async () => {
      const failuresBeforeSuccess = 10;
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          config: {
            failuresBeforeSuccess,
          },
          attemptTracking: {},
        },
      };

      // First 10 attempts should fail
      for (let i = 1; i <= failuresBeforeSuccess; i++) {
        const result = await mockFlakyService(context);
        expect(result.success).toBe(false);
        expect(result.data?.attemptNumber).toBe(i);
      }

      // 11th attempt should succeed
      const finalResult = await mockFlakyService(context);
      expect(finalResult.success).toBe(true);
      expect(finalResult.data?.attemptNumber).toBe(11);
    });
  });

  describe('Multiple Service Instance Tracking', () => {
    it('should track attempts independently for multiple services', async () => {
      const sharedMetadata = {
        attemptTracking: {},
      };

      const service1Context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          ...sharedMetadata,
          serviceName: 'service-1',
          config: {
            failuresBeforeSuccess: 1,
          },
        },
      };

      const service2Context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          ...sharedMetadata,
          serviceName: 'service-2',
          config: {
            failuresBeforeSuccess: 2,
          },
        },
      };

      // Service 1 - First attempt (should fail)
      const s1r1 = await mockFlakyService(service1Context);
      expect(s1r1.success).toBe(false);
      expect(s1r1.data?.attemptNumber).toBe(1);

      // Service 2 - First attempt (should fail)
      const s2r1 = await mockFlakyService(service2Context);
      expect(s2r1.success).toBe(false);
      expect(s2r1.data?.attemptNumber).toBe(1);

      // Service 1 - Second attempt (should succeed)
      const s1r2 = await mockFlakyService(service1Context);
      expect(s1r2.success).toBe(true);
      expect(s1r2.data?.attemptNumber).toBe(2);

      // Service 2 - Second attempt (should still fail)
      const s2r2 = await mockFlakyService(service2Context);
      expect(s2r2.success).toBe(false);
      expect(s2r2.data?.attemptNumber).toBe(2);

      // Service 2 - Third attempt (should succeed)
      const s2r3 = await mockFlakyService(service2Context);
      expect(s2r3.success).toBe(true);
      expect(s2r3.data?.attemptNumber).toBe(3);

      // Verify independent tracking
      expect(sharedMetadata.attemptTracking['service-1']).toBe(2);
      expect(sharedMetadata.attemptTracking['service-2']).toBe(3);
    });

    it('should maintain separate counters for three different services', async () => {
      const sharedMetadata = {
        attemptTracking: {},
      };

      const services = [
        { name: 'payment-api', failures: 1 },
        { name: 'email-service', failures: 3 },
        { name: 'notification-service', failures: 2 },
      ];

      // Run all services to completion
      for (const service of services) {
        const context: MockFlakyServiceContext = {
          runId: 'test-run-id',
          pipelineId: 'test-pipeline-id',
          prevResults: {},
          metadata: {
            ...sharedMetadata,
            serviceName: service.name,
            config: {
              failuresBeforeSuccess: service.failures,
            },
          },
        };

        // Fail the expected number of times
        for (let i = 1; i <= service.failures; i++) {
          const result = await mockFlakyService(context);
          expect(result.success).toBe(false);
          expect(result.data?.serviceName).toBe(service.name);
        }

        // Then succeed
        const successResult = await mockFlakyService(context);
        expect(successResult.success).toBe(true);
        expect(successResult.data?.serviceName).toBe(service.name);
        expect(sharedMetadata.attemptTracking[service.name]).toBe(service.failures + 1);
      }

      // Verify all counters
      expect(sharedMetadata.attemptTracking['payment-api']).toBe(2);
      expect(sharedMetadata.attemptTracking['email-service']).toBe(4);
      expect(sharedMetadata.attemptTracking['notification-service']).toBe(3);
    });
  });

  describe('Service Name Handling', () => {
    it('should use serviceName from metadata', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'custom-service',
          config: {
            failuresBeforeSuccess: 0,
          },
          attemptTracking: {},
        },
      };

      const result = await mockFlakyService(context);

      expect(result.success).toBe(true);
      expect(result.data?.serviceName).toBe('custom-service');
    });

    it('should use serviceName from context if not in metadata', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        serviceName: 'context-service',
        metadata: {
          config: {
            failuresBeforeSuccess: 0,
          },
          attemptTracking: {},
        },
      };

      const result = await mockFlakyService(context);

      expect(result.success).toBe(true);
      expect(result.data?.serviceName).toBe('context-service');
    });

    it('should use default service name if not provided', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            failuresBeforeSuccess: 0,
          },
          attemptTracking: {},
        },
      };

      const result = await mockFlakyService(context);

      expect(result.success).toBe(true);
      expect(result.data?.serviceName).toBe('default-service');
    });
  });

  describe('Attempt Tracking Initialization', () => {
    it('should initialize attemptTracking if not present', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          config: {
            failuresBeforeSuccess: 0,
          },
          // No attemptTracking provided
        },
      };

      const result = await mockFlakyService(context);

      expect(result.success).toBe(true);
      expect(context.metadata?.attemptTracking).toBeDefined();
      expect(context.metadata?.attemptTracking?.['test-service']).toBe(1);
    });

    it('should initialize metadata if not present', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        config: {
          failuresBeforeSuccess: 0,
        },
        // No metadata provided
      };

      const result = await mockFlakyService(context);

      expect(result.success).toBe(true);
      expect(context.metadata).toBeDefined();
      expect(context.metadata?.attemptTracking).toBeDefined();
    });

    it('should handle starting from existing attempt count', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          config: {
            failuresBeforeSuccess: 3,
          },
          attemptTracking: {
            'test-service': 2, // Already made 2 attempts
          },
        },
      };

      // Next attempt should be #3 (should fail)
      const result1 = await mockFlakyService(context);
      expect(result1.success).toBe(false);
      expect(result1.data?.attemptNumber).toBe(3);

      // Attempt #4 should succeed
      const result2 = await mockFlakyService(context);
      expect(result2.success).toBe(true);
      expect(result2.data?.attemptNumber).toBe(4);
    });
  });

  describe('Configuration Validation', () => {
    it('should fail when config is missing', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          attemptTracking: {},
        },
      };

      const result = await mockFlakyService(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No config provided');
    });

    it('should accept config from context.config instead of metadata', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        config: {
          failuresBeforeSuccess: 0,
        },
        metadata: {
          serviceName: 'test-service',
          attemptTracking: {},
        },
      };

      const result = await mockFlakyService(context);

      expect(result.success).toBe(true);
    });

    it('should fail when failuresBeforeSuccess is negative', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          config: {
            failuresBeforeSuccess: -1,
          },
          attemptTracking: {},
        },
      };

      const result = await mockFlakyService(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid failuresBeforeSuccess');
    });

    it('should fail when failuresBeforeSuccess is not a number', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          config: {
            failuresBeforeSuccess: 'invalid' as any,
          },
          attemptTracking: {},
        },
      };

      const result = await mockFlakyService(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid failuresBeforeSuccess');
    });
  });

  describe('Optional Delay Feature', () => {
    it('should apply delay when configured', async () => {
      const delay = 100;
      const startTime = Date.now();

      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          config: {
            failuresBeforeSuccess: 0,
            delay,
          },
          attemptTracking: {},
        },
      };

      const result = await mockFlakyService(context);
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(delay);
      expect(elapsed).toBeLessThan(delay + 100); // Allow 100ms tolerance
    });

    it('should handle zero delay', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          config: {
            failuresBeforeSuccess: 0,
            delay: 0,
          },
          attemptTracking: {},
        },
      };

      const result = await mockFlakyService(context);

      expect(result.success).toBe(true);
    });

    it('should not apply delay when not configured', async () => {
      const startTime = Date.now();

      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          config: {
            failuresBeforeSuccess: 0,
          },
          attemptTracking: {},
        },
      };

      const result = await mockFlakyService(context);
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('Response Data', () => {
    it('should include all required fields in response data', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          config: {
            failuresBeforeSuccess: 1,
          },
          attemptTracking: {},
        },
      };

      const result = await mockFlakyService(context);

      expect(result.data).toBeDefined();
      expect(result.data?.requestId).toBeDefined();
      expect(result.data?.serviceName).toBe('test-service');
      expect(result.data?.attemptNumber).toBe(1);
      expect(result.data?.totalAttempts).toBe(1);
      expect(result.data?.succeeded).toBe(false);
      expect(result.data?.completedAt).toBeInstanceOf(Date);
      expect(result.data?.config).toEqual({ failuresBeforeSuccess: 1 });
    });

    it('should generate unique request IDs', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          config: {
            failuresBeforeSuccess: 0,
          },
          attemptTracking: {},
        },
      };

      const result1 = await mockFlakyService(context);

      // Reset tracking for second call
      context.metadata!.attemptTracking = {};

      const result2 = await mockFlakyService(context);

      expect(result1.data?.requestId).not.toBe(result2.data?.requestId);
    });

    it('should include data even in failure responses', async () => {
      const context: MockFlakyServiceContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          serviceName: 'test-service',
          config: {
            failuresBeforeSuccess: 1,
          },
          attemptTracking: {},
        },
      };

      const result = await mockFlakyService(context);

      expect(result.success).toBe(false);
      expect(result.data).toBeDefined();
      expect(result.data?.succeeded).toBe(false);
      expect(result.data?.attemptNumber).toBe(1);
    });
  });
});
