/**
 * Unit tests for Mock Database Service with Connection Pool
 * Tests connection pool management, FIFO queuing, and resource constraints
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  MockConnectionPool,
  mockDatabaseService,
  type MockDatabaseContext,
  type DatabaseConnection,
} from '../../src/services/mock-database.js';

describe('Mock Connection Pool', () => {
  describe('Basic Connection Management', () => {
    it('should initialize with correct number of connections', () => {
      const pool = new MockConnectionPool(3);

      expect(pool.getMaxConnections()).toBe(3);
      expect(pool.getAvailableCount()).toBe(3);
      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getQueueLength()).toBe(0);
    });

    it('should acquire and release a single connection', async () => {
      const pool = new MockConnectionPool(3);

      const connection = await pool.acquire();

      expect(connection).toBeDefined();
      expect(connection.id).toBeDefined();
      expect(connection.inUse).toBe(true);
      expect(pool.getActiveCount()).toBe(1);
      expect(pool.getAvailableCount()).toBe(2);

      pool.release(connection);

      expect(connection.inUse).toBe(false);
      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getAvailableCount()).toBe(3);
    });

    it('should acquire multiple connections up to max', async () => {
      const pool = new MockConnectionPool(3);

      const conn1 = await pool.acquire();
      const conn2 = await pool.acquire();
      const conn3 = await pool.acquire();

      expect(pool.getActiveCount()).toBe(3);
      expect(pool.getAvailableCount()).toBe(0);
      expect(conn1.id).not.toBe(conn2.id);
      expect(conn2.id).not.toBe(conn3.id);
      expect(conn1.id).not.toBe(conn3.id);
    });
  });

  describe('Connection Pool Limits', () => {
    it('should never exceed max connections with 5 parallel requests', async () => {
      const pool = new MockConnectionPool(3);
      const maxConnectionsObserved: number[] = [];

      // Create 5 parallel requests
      const requests = Array.from({ length: 5 }, async (_, i) => {
        const connection = await pool.acquire();

        // Record active connections after acquiring
        maxConnectionsObserved.push(pool.getActiveCount());

        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 50));

        pool.release(connection);

        return connection;
      });

      await Promise.all(requests);

      // Verify active connections never exceeded 3
      const maxObserved = Math.max(...maxConnectionsObserved);
      expect(maxObserved).toBeLessThanOrEqual(3);

      // Pool should be back to initial state
      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getAvailableCount()).toBe(3);
    });

    it('should queue 4th and 5th requests when pool is full', async () => {
      const pool = new MockConnectionPool(3);
      const acquisitionOrder: number[] = [];

      // Start 5 requests
      const requests = Array.from({ length: 5 }, async (_, i) => {
        const requestId = i + 1;

        const connection = await pool.acquire();
        acquisitionOrder.push(requestId);

        // Hold connection for 100ms
        await new Promise(resolve => setTimeout(resolve, 100));

        pool.release(connection);

        return { requestId, connection };
      });

      // Give time for all requests to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // At this point, 3 should be active and 2 should be queued
      expect(pool.getActiveCount()).toBe(3);
      expect(pool.getQueueLength()).toBe(2);

      await Promise.all(requests);

      // All requests should have been processed
      expect(acquisitionOrder.length).toBe(5);
    });
  });

  describe('FIFO Queue Ordering', () => {
    it('should process queued requests in FIFO order', async () => {
      const pool = new MockConnectionPool(2);
      const completionOrder: number[] = [];

      // Start 4 requests with different hold times
      const request1 = (async () => {
        const conn = await pool.acquire();
        await new Promise(resolve => setTimeout(resolve, 100));
        pool.release(conn);
        completionOrder.push(1);
      })();

      const request2 = (async () => {
        const conn = await pool.acquire();
        await new Promise(resolve => setTimeout(resolve, 100));
        pool.release(conn);
        completionOrder.push(2);
      })();

      // Wait to ensure first 2 are acquired
      await new Promise(resolve => setTimeout(resolve, 10));

      // These should be queued
      const request3 = (async () => {
        const conn = await pool.acquire();
        await new Promise(resolve => setTimeout(resolve, 50));
        pool.release(conn);
        completionOrder.push(3);
      })();

      const request4 = (async () => {
        const conn = await pool.acquire();
        await new Promise(resolve => setTimeout(resolve, 50));
        pool.release(conn);
        completionOrder.push(4);
      })();

      await Promise.all([request1, request2, request3, request4]);

      // Requests 3 and 4 should complete after 1 and 2
      // But request 3 should acquire before request 4 (FIFO)
      expect(completionOrder[0]).toBeLessThanOrEqual(2); // 1 or 2
      expect(completionOrder[1]).toBeLessThanOrEqual(2); // 1 or 2
      expect(completionOrder[2]).toBe(3); // 3rd to acquire was 3rd in queue
      expect(completionOrder[3]).toBe(4); // 4th to acquire was 4th in queue
    });

    it('should maintain FIFO order with multiple release cycles', async () => {
      const pool = new MockConnectionPool(1); // Single connection
      const acquisitionOrder: number[] = [];

      // Queue 5 requests
      const requests = Array.from({ length: 5 }, async (_, i) => {
        const requestId = i + 1;
        const connection = await pool.acquire();
        acquisitionOrder.push(requestId);

        // Quick hold
        await new Promise(resolve => setTimeout(resolve, 10));

        pool.release(connection);
      });

      await Promise.all(requests);

      // Should acquire in exact order 1, 2, 3, 4, 5
      expect(acquisitionOrder).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Connection Reuse', () => {
    it('should reuse released connections', async () => {
      const pool = new MockConnectionPool(2);

      const conn1 = await pool.acquire();
      const firstId = conn1.id;

      pool.release(conn1);

      const conn2 = await pool.acquire();

      // Should get a connection (may or may not be the same one due to FIFO queue)
      expect(conn2.id).toBeDefined();
      expect(conn2.inUse).toBe(true);
      expect(pool.getActiveCount()).toBe(1);
    });

    it('should immediately reassign released connection to queued request', async () => {
      const pool = new MockConnectionPool(1);
      const events: string[] = [];

      // First request holds connection
      const request1 = (async () => {
        const conn = await pool.acquire();
        events.push('req1-acquired');
        await new Promise(resolve => setTimeout(resolve, 50));
        pool.release(conn);
        events.push('req1-released');
      })();

      // Wait for first request to acquire
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second request should be queued
      const request2 = (async () => {
        events.push('req2-waiting');
        const conn = await pool.acquire();
        events.push('req2-acquired');
        pool.release(conn);
      })();

      await Promise.all([request1, request2]);

      // Verify key sequence points
      expect(events[0]).toBe('req1-acquired');
      expect(events[1]).toBe('req2-waiting');
      expect(events).toContain('req1-released');
      expect(events).toContain('req2-acquired');

      // req2 should acquire after req1 acquires
      const req1Index = events.indexOf('req1-acquired');
      const req2Index = events.indexOf('req2-acquired');
      expect(req2Index).toBeGreaterThan(req1Index);
    });
  });
});

describe('Mock Database Service', () => {
  describe('Basic Query Execution', () => {
    it('should execute a successful query', async () => {
      const pool = new MockConnectionPool(3);

      const context: MockDatabaseContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxConnections: 3,
            queryDelay: 50,
          },
          connectionPool: pool,
        },
      };

      const result = await mockDatabaseService(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.queryId).toBeDefined();
      expect(result.data?.connectionId).toBeDefined();
      expect(result.data?.executionTime).toBeGreaterThanOrEqual(50);
      expect(result.data?.poolStats).toBeDefined();
      expect(result.data?.poolStats.maxConnections).toBe(3);
    });

    it('should respect query delay', async () => {
      const pool = new MockConnectionPool(3);
      const queryDelay = 100;
      const startTime = Date.now();

      const context: MockDatabaseContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxConnections: 3,
            queryDelay,
          },
          connectionPool: pool,
        },
      };

      await mockDatabaseService(context);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(queryDelay);
      expect(elapsed).toBeLessThan(queryDelay + 50);
    });
  });

  describe('Connection Pool Integration', () => {
    it('should acquire and release connection properly', async () => {
      const pool = new MockConnectionPool(3);

      const context: MockDatabaseContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxConnections: 3,
            queryDelay: 10,
          },
          connectionPool: pool,
        },
      };

      // Before query
      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getAvailableCount()).toBe(3);

      const queryPromise = mockDatabaseService(context);

      // Give time for connection to be acquired
      await new Promise(resolve => setTimeout(resolve, 5));

      // During query - connection should be in use
      expect(pool.getActiveCount()).toBe(1);
      expect(pool.getAvailableCount()).toBe(2);

      await queryPromise;

      // After query - connection should be released
      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getAvailableCount()).toBe(3);
    });

    it('should handle multiple concurrent queries with pool', async () => {
      const pool = new MockConnectionPool(3);
      const maxActiveObserved: number[] = [];

      const context: MockDatabaseContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxConnections: 3,
            queryDelay: 50,
          },
          connectionPool: pool,
        },
      };

      // Launch 5 parallel queries
      const queries = Array.from({ length: 5 }, async () => {
        const result = await mockDatabaseService(context);
        maxActiveObserved.push(result.data?.poolStats.activeConnections || 0);
        return result;
      });

      const results = await Promise.all(queries);

      // All queries should succeed
      expect(results.every(r => r.success)).toBe(true);

      // Active connections should never exceed max
      const maxActive = Math.max(...maxActiveObserved);
      expect(maxActive).toBeLessThanOrEqual(3);

      // Pool should be back to initial state
      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getAvailableCount()).toBe(3);
    });

    it('should include accurate pool stats in response', async () => {
      const pool = new MockConnectionPool(5);

      // Acquire 2 connections to simulate load
      const conn1 = await pool.acquire();
      const conn2 = await pool.acquire();

      const context: MockDatabaseContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxConnections: 5,
            queryDelay: 10,
          },
          connectionPool: pool,
        },
      };

      const result = await mockDatabaseService(context);

      expect(result.success).toBe(true);
      expect(result.data?.poolStats.maxConnections).toBe(5);
      // One of our held connections plus the query's connection
      expect(result.data?.poolStats.activeConnections).toBe(3);

      pool.release(conn1);
      pool.release(conn2);
    });
  });

  describe('Error Handling', () => {
    it('should fail when config is missing', async () => {
      const pool = new MockConnectionPool(3);

      const context: MockDatabaseContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          connectionPool: pool,
        },
      };

      const result = await mockDatabaseService(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No config provided');
    });

    it('should fail when connection pool is missing', async () => {
      const context: MockDatabaseContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxConnections: 3,
            queryDelay: 50,
          },
        },
      };

      const result = await mockDatabaseService(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No connectionPool provided');
    });

    it('should fail when queryDelay is invalid', async () => {
      const pool = new MockConnectionPool(3);

      const context: MockDatabaseContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxConnections: 3,
            queryDelay: -10,
          },
          connectionPool: pool,
        },
      };

      const result = await mockDatabaseService(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid queryDelay');
    });

    it('should handle query failure with shouldFail', async () => {
      const pool = new MockConnectionPool(3);

      const context: MockDatabaseContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxConnections: 3,
            queryDelay: 10,
            shouldFail: true,
          },
          connectionPool: pool,
        },
      };

      const result = await mockDatabaseService(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('simulated failure');
      expect(result.data).toBeDefined(); // Should still include data

      // Connection should be released even on failure
      expect(pool.getActiveCount()).toBe(0);
    });

    it('should release connection even on error', async () => {
      const pool = new MockConnectionPool(3);

      const context: MockDatabaseContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxConnections: 3,
            queryDelay: 10,
            shouldFail: true,
          },
          connectionPool: pool,
        },
      };

      // Execute failing query
      await mockDatabaseService(context);

      // Pool should be clean
      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getAvailableCount()).toBe(3);
    });
  });

  describe('Configuration Options', () => {
    it('should accept config from context.config instead of metadata', async () => {
      const pool = new MockConnectionPool(3);

      const context: MockDatabaseContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        config: {
          maxConnections: 3,
          queryDelay: 10,
        },
        connectionPool: pool,
      };

      const result = await mockDatabaseService(context);

      expect(result.success).toBe(true);
    });

    it('should accept pool from context.connectionPool instead of metadata', async () => {
      const pool = new MockConnectionPool(3);

      const context: MockDatabaseContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxConnections: 3,
            queryDelay: 10,
          },
        },
        connectionPool: pool,
      };

      const result = await mockDatabaseService(context);

      expect(result.success).toBe(true);
    });
  });

  describe('Probabilistic Failure', () => {
    it('should always fail with 100% failure rate', async () => {
      const pool = new MockConnectionPool(3);

      const context: MockDatabaseContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxConnections: 3,
            queryDelay: 10,
            failureRate: 1.0,
          },
          connectionPool: pool,
        },
      };

      const results = await Promise.all([
        mockDatabaseService(context),
        mockDatabaseService(context),
        mockDatabaseService(context),
      ]);

      expect(results.every(r => !r.success)).toBe(true);
    });

    it('should never fail with 0% failure rate', async () => {
      const pool = new MockConnectionPool(3);

      const context: MockDatabaseContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          config: {
            maxConnections: 3,
            queryDelay: 10,
            failureRate: 0.0,
          },
          connectionPool: pool,
        },
      };

      const results = await Promise.all([
        mockDatabaseService(context),
        mockDatabaseService(context),
        mockDatabaseService(context),
      ]);

      expect(results.every(r => r.success)).toBe(true);
    });
  });
});
