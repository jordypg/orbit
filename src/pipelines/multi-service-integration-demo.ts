/**
 * Multi-Service Integration Demo Pipeline
 *
 * Demonstrates complex orchestration of multiple disparate services with:
 * - HTTP API calls with retry logic
 * - Database operations with connection pooling
 * - Rate-limited third-party API integration
 * - Cross-service data validation
 * - Message queue publishing simulation
 *
 * This pipeline showcases real-world integration patterns including:
 * - Service coordination and dependency management
 * - Data consistency validation across services
 * - Resource pool management (database connections)
 * - Rate limit handling with backoff
 * - Error propagation and recovery strategies
 */

import { definePipeline, step } from '../core/index.js';
import { mockSlowAPI, type MockSlowAPIData } from '../services/mock-slow-api.js';
import {
  mockDatabaseService,
  MockConnectionPool,
  type MockDatabaseData
} from '../services/mock-database.js';
import {
  mockRateLimitedAPI,
  type MockRateLimitedAPIData
} from '../services/mock-rate-limited-api.js';
import type { StepContext, StepResult } from '../core/types.js';

/**
 * Mock business data returned by HTTP API
 */
export interface APIUserData {
  user_count: number;
  timestamp: string;
  api_response: MockSlowAPIData;
}

/**
 * Mock business data returned by Database
 */
export interface DatabaseUserData {
  user_records: Array<{ id: number; name: string }>;
  total_count: number;
  db_response: MockDatabaseData;
}

/**
 * Mock business data returned by Rate-Limited Service
 */
export interface RateLimitedEnrichmentData {
  enrichment_status: string;
  enrichment_score: number;
  rate_limit_response: MockRateLimitedAPIData;
}

/**
 * Cross-service validation result
 */
export interface ValidationResult {
  valid: boolean;
  checks: {
    user_count_match: boolean;
    timing_acceptable: boolean;
    all_services_successful: boolean;
  };
  details: {
    api_user_count: number;
    db_user_count: number;
    total_execution_time_ms: number;
    service_statuses: Record<string, boolean>;
  };
  errors?: string[];
}

/**
 * Message queue publication result
 */
export interface QueuePublicationData {
  queue_name: string;
  message_id: string;
  published_at: string;
  payload_size_bytes: number;
  aggregated_data: {
    api: APIUserData;
    database: DatabaseUserData;
    enrichment: RateLimitedEnrichmentData;
    validation: ValidationResult;
  };
}

// Shared connection pool for database operations
// In a real application, this would be managed by a connection pool manager
let connectionPool: MockConnectionPool | null = null;

/**
 * Get or create the database connection pool
 */
function getConnectionPool(): MockConnectionPool {
  if (!connectionPool) {
    connectionPool = new MockConnectionPool(3);
    console.log('🔌 Created new database connection pool (max: 3 connections)');
  }
  return connectionPool;
}

export default definePipeline({
  name: 'multi-service-integration-demo',
  description: 'Orchestrate multiple services (HTTP API, Database, Rate-Limited API) with validation and message queue publishing',

  steps: [
    // Step 1: HTTP API Call - Simulate fetching user count from external API
    step('http-api-call', async (ctx: StepContext): Promise<StepResult<APIUserData>> => {
      console.log('\n📡 Step 1: HTTP API Call');
      console.log('═'.repeat(50));

      try {
        // Get configuration from context metadata
        const apiConfig = (ctx.metadata?.apiConfig as any) || {
          delay: 5000,
          shouldFail: false,
        };

        console.log(`  Calling HTTP API with ${apiConfig.delay}ms delay...`);

        // Call the mock slow API
        const apiResult = await mockSlowAPI({
          ...ctx,
          metadata: {
            ...ctx.metadata,
            config: apiConfig,
          },
        });

        if (!apiResult.success) {
          console.error(`  ❌ HTTP API call failed: ${apiResult.error}`);
          return {
            success: false,
            error: `HTTP API call failed: ${apiResult.error}`,
          };
        }

        // Augment the response with mock business data
        const user_count = Math.floor(Math.random() * 11) + 5; // Random 5-15 users

        const userData: APIUserData = {
          user_count,
          timestamp: new Date().toISOString(),
          api_response: apiResult.data!,
        };

        console.log(`  ✅ HTTP API Success`);
        console.log(`  📊 User Count: ${user_count}`);
        console.log(`  ⏱️  Processing Time: ${apiResult.data!.processingTime}ms`);

        return {
          success: true,
          data: userData,
        };
      } catch (error: any) {
        console.error(`  ❌ HTTP API error:`, error.message);
        return {
          success: false,
          error: `HTTP API failed: ${error.message}`,
        };
      }
    }, {
      maxRetries: 2,
      timeout: 5000, // 5 seconds
    }),

    // Step 2: Database Query - Simulate fetching user records from database
    step('database-query', async (ctx: StepContext): Promise<StepResult<DatabaseUserData>> => {
      console.log('\n💾 Step 2: Database Query');
      console.log('═'.repeat(50));

      try {
        // Validate previous step
        const apiResult = ctx.prevResults['http-api-call'] as any;
        if (!apiResult || !apiResult.success) {
          const errorMsg = apiResult?.error || 'No HTTP API data available';
          console.error(`  ❌ Cannot query database: ${errorMsg}`);
          return {
            success: false,
            error: `Cannot query database: HTTP API step failed - ${errorMsg}`,
          };
        }

        const apiData = apiResult.data as APIUserData;
        console.log(`  ℹ️  API reported ${apiData.user_count} users`);

        // Get or create connection pool
        const pool = getConnectionPool();

        // Get database configuration from context metadata
        const dbConfig = (ctx.metadata?.dbConfig as any) || {
          maxConnections: 3,
          queryDelay: 500,
          shouldFail: false,
        };

        console.log(`  Querying database with ${dbConfig.queryDelay}ms delay...`);

        // Call the mock database service
        const dbResult = await mockDatabaseService({
          ...ctx,
          metadata: {
            ...ctx.metadata,
            config: dbConfig,
            connectionPool: pool,
          },
        });

        if (!dbResult.success) {
          console.error(`  ❌ Database query failed: ${dbResult.error}`);
          return {
            success: false,
            error: `Database query failed: ${dbResult.error}`,
          };
        }

        // Augment the response with mock user records
        // In this demo, we'll create the same number of records as API reported
        const user_records = Array.from({ length: apiData.user_count }, (_, i) => ({
          id: i + 1,
          name: `User ${i + 1}`,
        }));

        const dbData: DatabaseUserData = {
          user_records,
          total_count: user_records.length,
          db_response: dbResult.data!,
        };

        console.log(`  ✅ Database Query Success`);
        console.log(`  📊 Records Retrieved: ${user_records.length}`);
        console.log(`  🔌 Connection: ${dbResult.data!.connectionId}`);
        console.log(`  ⏱️  Execution Time: ${dbResult.data!.executionTime}ms`);
        console.log(`  📈 Pool Stats: ${dbResult.data!.poolStats.activeConnections}/${dbResult.data!.poolStats.maxConnections} active`);

        return {
          success: true,
          data: dbData,
        };
      } catch (error: any) {
        console.error(`  ❌ Database error:`, error.message);
        return {
          success: false,
          error: `Database query failed: ${error.message}`,
        };
      }
    }, {
      maxRetries: 2,
      timeout: 10000, // 10 seconds
    }),

    // Step 3: Rate-Limited Service - Simulate calling third-party enrichment service
    step('rate-limited-service', async (ctx: StepContext): Promise<StepResult<RateLimitedEnrichmentData>> => {
      console.log('\n🚦 Step 3: Rate-Limited Service Call');
      console.log('═'.repeat(50));

      try {
        // Validate previous steps
        const apiResult = ctx.prevResults['http-api-call'] as any;
        const dbResult = ctx.prevResults['database-query'] as any;

        if (!apiResult || !apiResult.success) {
          console.error(`  ❌ Cannot call rate-limited service: HTTP API failed`);
          return {
            success: false,
            error: `Cannot call rate-limited service: HTTP API step failed`,
          };
        }

        if (!dbResult || !dbResult.success) {
          console.error(`  ❌ Cannot call rate-limited service: Database query failed`);
          return {
            success: false,
            error: `Cannot call rate-limited service: Database query step failed`,
          };
        }

        // Get rate limit configuration from context metadata
        const rateLimitConfig = (ctx.metadata?.rateLimitConfig as any) || {
          maxCalls: 3,
          windowMs: 1000,
          delay: 200,
          identifier: 'multi-service-demo',
        };

        console.log(`  Calling rate-limited service (${rateLimitConfig.maxCalls} calls/${rateLimitConfig.windowMs}ms)...`);

        // Call the rate-limited service
        const rateLimitResult = await mockRateLimitedAPI({
          ...ctx,
          metadata: {
            ...ctx.metadata,
            config: rateLimitConfig,
          },
        });

        if (!rateLimitResult.success) {
          console.error(`  ❌ Rate-limited service call failed: ${rateLimitResult.error}`);
          return {
            success: false,
            error: `Rate-limited service call failed: ${rateLimitResult.error}`,
          };
        }

        // Augment the response with mock enrichment data
        const enrichmentData: RateLimitedEnrichmentData = {
          enrichment_status: 'completed',
          enrichment_score: Math.random() * 100, // Random score 0-100
          rate_limit_response: rateLimitResult.data!,
        };

        console.log(`  ✅ Rate-Limited Service Success`);
        console.log(`  📊 Enrichment Score: ${enrichmentData.enrichment_score.toFixed(2)}`);
        console.log(`  🚦 Rate Limit: ${rateLimitResult.data!.callsInWindow}/${rateLimitResult.data!.maxCalls} calls used`);
        console.log(`  📉 Remaining: ${rateLimitResult.data!.remainingCalls} calls`);

        return {
          success: true,
          data: enrichmentData,
        };
      } catch (error: any) {
        console.error(`  ❌ Rate-limited service error:`, error.message);
        return {
          success: false,
          error: `Rate-limited service failed: ${error.message}`,
        };
      }
    }, {
      maxRetries: 2,
      timeout: 5000, // 5 seconds
    }),

    // Step 4: Cross-Service Validation - Validate data consistency across all services
    step('cross-service-validation', async (ctx: StepContext): Promise<StepResult<ValidationResult>> => {
      console.log('\n✅ Step 4: Cross-Service Validation');
      console.log('═'.repeat(50));

      try {
        // Get results from all previous steps
        const apiResult = ctx.prevResults['http-api-call'] as any;
        const dbResult = ctx.prevResults['database-query'] as any;
        const rateLimitResult = ctx.prevResults['rate-limited-service'] as any;

        const errors: string[] = [];
        const checks = {
          user_count_match: false,
          timing_acceptable: false,
          all_services_successful: false,
        };

        // Check 1: All services successful
        const allSuccessful = apiResult?.success && dbResult?.success && rateLimitResult?.success;
        checks.all_services_successful = allSuccessful;

        if (!allSuccessful) {
          errors.push('One or more services failed to complete successfully');
        }

        if (!allSuccessful) {
          console.error(`  ❌ Validation Failed: Not all services completed successfully`);
          return {
            success: false,
            error: 'Cross-service validation failed: Not all services completed successfully',
            data: {
              valid: false,
              checks,
              details: {
                api_user_count: 0,
                db_user_count: 0,
                total_execution_time_ms: 0,
                service_statuses: {
                  'http-api': apiResult?.success || false,
                  'database': dbResult?.success || false,
                  'rate-limited': rateLimitResult?.success || false,
                },
              },
              errors,
            },
          };
        }

        const apiData = apiResult.data as APIUserData;
        const dbData = dbResult.data as DatabaseUserData;
        const enrichmentData = rateLimitResult.data as RateLimitedEnrichmentData;

        // Check 2: User count consistency
        const userCountMatch = apiData.user_count === dbData.total_count;
        checks.user_count_match = userCountMatch;

        if (!userCountMatch) {
          errors.push(
            `User count mismatch: API reports ${apiData.user_count} but database has ${dbData.total_count} records`
          );
        }

        // Check 3: Timing validation (total time should be reasonable)
        const totalTime =
          apiData.api_response.processingTime +
          dbData.db_response.executionTime +
          (enrichmentData.rate_limit_response.completedAt.getTime() -
           new Date(apiData.timestamp).getTime());

        const timingThreshold = (ctx.metadata?.timingThresholdMs as number) || 30000; // Default 30 seconds
        const timingAcceptable = totalTime < timingThreshold;
        checks.timing_acceptable = timingAcceptable;

        if (!timingAcceptable) {
          errors.push(`Total execution time ${totalTime}ms exceeds threshold ${timingThreshold}ms`);
        }

        const valid = checks.user_count_match && checks.timing_acceptable && checks.all_services_successful;

        const validation: ValidationResult = {
          valid,
          checks,
          details: {
            api_user_count: apiData.user_count,
            db_user_count: dbData.total_count,
            total_execution_time_ms: totalTime,
            service_statuses: {
              'http-api': true,
              'database': true,
              'rate-limited': true,
            },
          },
          errors: errors.length > 0 ? errors : undefined,
        };

        if (valid) {
          console.log(`  ✅ All Validation Checks Passed`);
          console.log(`  📊 User Count Match: ${apiData.user_count} = ${dbData.total_count}`);
          console.log(`  ⏱️  Total Execution Time: ${totalTime}ms`);
          console.log(`  🎯 All Services: Successful`);
        } else {
          console.error(`  ❌ Validation Failed:`);
          errors.forEach(err => console.error(`     - ${err}`));
          return {
            success: false,
            error: `Cross-service validation failed: ${errors.join('; ')}`,
            data: validation,
          };
        }

        return {
          success: true,
          data: validation,
        };
      } catch (error: any) {
        console.error(`  ❌ Validation error:`, error.message);
        return {
          success: false,
          error: `Cross-service validation failed: ${error.message}`,
        };
      }
    }),

    // Step 5: Publish to Message Queue - Simulate publishing aggregated result
    step('publish-to-queue', async (ctx: StepContext): Promise<StepResult<QueuePublicationData>> => {
      console.log('\n📤 Step 5: Publish to Message Queue');
      console.log('═'.repeat(50));

      try {
        // Validate previous step
        const validationResult = ctx.prevResults['cross-service-validation'] as any;

        if (!validationResult || !validationResult.success) {
          const errorMsg = validationResult?.error || 'Validation failed';
          console.error(`  ❌ Cannot publish: ${errorMsg}`);
          return {
            success: false,
            error: `Cannot publish to queue: Validation failed - ${errorMsg}`,
          };
        }

        const apiData = (ctx.prevResults['http-api-call'] as any).data as APIUserData;
        const dbData = (ctx.prevResults['database-query'] as any).data as DatabaseUserData;
        const enrichmentData = (ctx.prevResults['rate-limited-service'] as any).data as RateLimitedEnrichmentData;
        const validation = validationResult.data as ValidationResult;

        console.log(`  📦 Preparing message payload...`);

        // Simulate message queue publishing delay
        const publishDelay = (ctx.metadata?.publishDelayMs as number) || 100;
        await new Promise(resolve => setTimeout(resolve, publishDelay));

        // Create aggregated payload
        const aggregated_data = {
          api: apiData,
          database: dbData,
          enrichment: enrichmentData,
          validation,
        };

        const payload_size = JSON.stringify(aggregated_data).length;

        const publication: QueuePublicationData = {
          queue_name: 'user-integration-events',
          message_id: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          published_at: new Date().toISOString(),
          payload_size_bytes: payload_size,
          aggregated_data,
        };

        console.log(`  ✅ Message Published Successfully`);
        console.log(`  🏷️  Message ID: ${publication.message_id}`);
        console.log(`  📮 Queue: ${publication.queue_name}`);
        console.log(`  📦 Payload Size: ${payload_size} bytes`);
        console.log(`  ⏱️  Published At: ${publication.published_at}`);

        console.log('\n' + '═'.repeat(50));
        console.log('🎉 Multi-Service Integration Pipeline Completed Successfully!\n');

        return {
          success: true,
          data: publication,
        };
      } catch (error: any) {
        console.error(`  ❌ Publish error:`, error.message);
        return {
          success: false,
          error: `Failed to publish to queue: ${error.message}`,
        };
      }
    }, {
      maxRetries: 1,
      timeout: 3000, // 3 seconds
    }),
  ],
});
