/**
 * Mock Database Service
 * Simulates a database with a limited connection pool for testing resource management
 */

import { randomUUID } from 'crypto';
import type { StepResult, StepContext } from '../core/types.js';

/**
 * Represents a database connection
 */
export interface DatabaseConnection {
  /** Unique connection identifier */
  id: string;

  /** Timestamp when connection was acquired */
  acquiredAt: Date;

  /** Whether the connection is currently in use */
  inUse: boolean;
}

/**
 * Connection pool for managing database connections
 */
export class MockConnectionPool {
  private connections: DatabaseConnection[] = [];
  private availableConnections: DatabaseConnection[] = [];
  private waitingQueue: Array<(connection: DatabaseConnection) => void> = [];

  /**
   * Create a new connection pool
   *
   * @param maxConnections - Maximum number of connections in the pool
   */
  constructor(private maxConnections: number) {
    // Initialize the pool with available connections
    for (let i = 0; i < maxConnections; i++) {
      const connection: DatabaseConnection = {
        id: `conn-${i + 1}`,
        acquiredAt: new Date(),
        inUse: false,
      };
      this.connections.push(connection);
      this.availableConnections.push(connection);
    }
  }

  /**
   * Acquire a connection from the pool
   * If no connection is available, the request will be queued (FIFO)
   *
   * @returns Promise that resolves with a database connection
   */
  async acquire(): Promise<DatabaseConnection> {
    return new Promise<DatabaseConnection>((resolve) => {
      // Check if there's an available connection
      if (this.availableConnections.length > 0) {
        const connection = this.availableConnections.shift()!;
        connection.inUse = true;
        connection.acquiredAt = new Date();
        console.log(
          `  🔌 Connection ${connection.id} acquired. Active: ${this.getActiveCount()}/${this.maxConnections}`
        );
        resolve(connection);
      } else {
        // No available connections, add to waiting queue
        console.log(
          `  ⏳ No connections available. Queued. Queue length: ${this.waitingQueue.length + 1}`
        );
        this.waitingQueue.push(resolve);
      }
    });
  }

  /**
   * Release a connection back to the pool
   * If there are waiting requests, the connection is immediately given to the next in queue
   *
   * @param connection - Connection to release
   */
  release(connection: DatabaseConnection): void {
    connection.inUse = false;

    // Check if there are waiting requests in the queue
    if (this.waitingQueue.length > 0) {
      // Give this connection to the next waiting request (FIFO)
      const nextResolver = this.waitingQueue.shift()!;
      connection.inUse = true;
      connection.acquiredAt = new Date();
      console.log(
        `  🔄 Connection ${connection.id} released and immediately reassigned. Queue: ${this.waitingQueue.length}`
      );
      nextResolver(connection);
    } else {
      // Return to available pool
      this.availableConnections.push(connection);
      console.log(
        `  ✅ Connection ${connection.id} released. Available: ${this.availableConnections.length}/${this.maxConnections}`
      );
    }
  }

  /**
   * Get the number of currently active (in-use) connections
   */
  getActiveCount(): number {
    return this.connections.filter(c => c.inUse).length;
  }

  /**
   * Get the number of available connections
   */
  getAvailableCount(): number {
    return this.availableConnections.length;
  }

  /**
   * Get the current queue length
   */
  getQueueLength(): number {
    return this.waitingQueue.length;
  }

  /**
   * Get the maximum connections allowed
   */
  getMaxConnections(): number {
    return this.maxConnections;
  }
}

/**
 * Configuration for the mock database service
 */
export interface MockDatabaseConfig {
  /** Maximum number of concurrent connections */
  maxConnections: number;

  /** Query execution delay in milliseconds */
  queryDelay: number;

  /** Whether the query should fail */
  shouldFail?: boolean;

  /** Probability of query failure (0-1) */
  failureRate?: number;
}

/**
 * Database query response data
 */
export interface MockDatabaseData {
  /** Unique query identifier */
  queryId: string;

  /** Connection that executed the query */
  connectionId: string;

  /** Query execution time in milliseconds */
  executionTime: number;

  /** Timestamp when query completed */
  completedAt: Date;

  /** Connection pool statistics at time of query */
  poolStats: {
    activeConnections: number;
    availableConnections: number;
    queueLength: number;
    maxConnections: number;
  };
}

/**
 * Context for mock database service step
 */
export interface MockDatabaseContext extends StepContext {
  config?: MockDatabaseConfig;
  connectionPool?: MockConnectionPool;
  metadata?: {
    config?: MockDatabaseConfig;
    connectionPool?: MockConnectionPool;
  };
}

/**
 * Mock Database Service Handler
 *
 * Simulates database queries with connection pool management.
 * Acquires a connection, executes query with delay, then releases connection.
 *
 * @param context - Step context containing database configuration and connection pool
 * @returns StepResult with query response data
 *
 * @example
 * ```typescript
 * const pool = new MockConnectionPool(3);
 *
 * const result = await mockDatabaseService({
 *   runId: 'run-123',
 *   pipelineId: 'pipeline-123',
 *   prevResults: {},
 *   metadata: {
 *     config: { maxConnections: 3, queryDelay: 100 },
 *     connectionPool: pool
 *   }
 * });
 * ```
 */
export async function mockDatabaseService(
  context: MockDatabaseContext
): Promise<StepResult<MockDatabaseData>> {
  const queryId = randomUUID();
  let connection: DatabaseConnection | null = null;

  try {
    // Get config and pool from context
    const config = context.metadata?.config || context.config;
    const pool = context.metadata?.connectionPool || context.connectionPool;

    if (!config) {
      return {
        success: false,
        error: 'No config provided in context.metadata.config or context.config',
      };
    }

    if (!pool) {
      return {
        success: false,
        error: 'No connectionPool provided in context.metadata.connectionPool or context.connectionPool',
      };
    }

    const { queryDelay, shouldFail, failureRate } = config;

    // Validate configuration
    if (typeof queryDelay !== 'number' || queryDelay < 0) {
      return {
        success: false,
        error: 'Invalid queryDelay: must be a non-negative number',
      };
    }

    console.log(`💾 Mock Database: Query ${queryId} started`);

    // Acquire a connection from the pool
    const startTime = Date.now();
    connection = await pool.acquire();
    const acquireTime = Date.now() - startTime;

    if (acquireTime > 0) {
      console.log(`  ⏱️  Connection acquired after ${acquireTime}ms wait`);
    }

    // Simulate query execution
    await new Promise(resolve => setTimeout(resolve, queryDelay));

    const executionTime = Date.now() - startTime;

    // Determine if query should fail
    let shouldQueryFail = false;

    if (failureRate !== undefined) {
      // Use probabilistic failure
      shouldQueryFail = Math.random() < failureRate;
    } else if (shouldFail !== undefined) {
      // Use deterministic failure
      shouldQueryFail = shouldFail;
    }

    // Get pool statistics
    const poolStats = {
      activeConnections: pool.getActiveCount(),
      availableConnections: pool.getAvailableCount(),
      queueLength: pool.getQueueLength(),
      maxConnections: pool.getMaxConnections(),
    };

    const data: MockDatabaseData = {
      queryId,
      connectionId: connection.id,
      executionTime,
      completedAt: new Date(),
      poolStats,
    };

    // Release the connection back to the pool
    pool.release(connection);

    if (shouldQueryFail) {
      console.log(`  ❌ Query ${queryId} failed (simulated failure)`);
      return {
        success: false,
        error: `Database query failed (simulated failure)`,
        data,
      };
    }

    console.log(
      `  ✅ Query ${queryId} completed in ${executionTime}ms using connection ${connection.id}`
    );

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    // Ensure connection is released even on error
    if (connection && context.metadata?.connectionPool) {
      context.metadata.connectionPool.release(connection);
    } else if (connection && context.connectionPool) {
      context.connectionPool.release(connection);
    }

    console.error(`❌ Mock Database error:`, error.message);
    return {
      success: false,
      error: `Mock Database failed: ${error.message}`,
    };
  }
}

export default mockDatabaseService;
