/**
 * Integration Test Environment Setup
 * Utilities for configuring S3 and Veryfi services for integration testing
 */

/**
 * S3 Test Configuration
 */
export interface S3TestConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Veryfi Test Configuration
 */
export interface VeryfiTestConfig {
  clientId: string;
  clientSecret?: string;
  username: string;
  apiKey: string;
  baseUrl: string;
}

/**
 * Complete Integration Test Environment Configuration
 */
export interface IntegrationTestEnv {
  s3: S3TestConfig;
  veryfi: VeryfiTestConfig;
}

/**
 * Get S3 test configuration from environment variables
 *
 * Required environment variables:
 * - AWS_TEST_S3_BUCKET or AWS_S3_BUCKET
 * - AWS_REGION
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 */
export function getS3TestConfig(): S3TestConfig {
  const bucket = process.env.AWS_TEST_S3_BUCKET || process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    const missing: string[] = [];
    if (!bucket) missing.push('AWS_TEST_S3_BUCKET or AWS_S3_BUCKET');
    if (!region) missing.push('AWS_REGION');
    if (!accessKeyId) missing.push('AWS_ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('AWS_SECRET_ACCESS_KEY');

    throw new Error(
      `Missing required S3 test configuration: ${missing.join(', ')}`
    );
  }

  return {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
  };
}

/**
 * Get Veryfi test configuration from environment variables
 *
 * Required environment variables:
 * - VERYFI_TEST_CLIENT_ID or VERYFI_CLIENT_ID
 * - VERYFI_TEST_USERNAME or VERYFI_USERNAME
 * - VERYFI_TEST_API_KEY or VERYFI_API_KEY
 *
 * Optional environment variables:
 * - VERYFI_TEST_CLIENT_SECRET or VERYFI_CLIENT_SECRET
 * - VERYFI_TEST_API_BASE_URL or VERYFI_API_BASE_URL (defaults to production URL)
 */
export function getVeryfiTestConfig(): VeryfiTestConfig {
  const clientId = process.env.VERYFI_TEST_CLIENT_ID || process.env.VERYFI_CLIENT_ID;
  const clientSecret = process.env.VERYFI_TEST_CLIENT_SECRET || process.env.VERYFI_CLIENT_SECRET;
  const username = process.env.VERYFI_TEST_USERNAME || process.env.VERYFI_USERNAME;
  const apiKey = process.env.VERYFI_TEST_API_KEY || process.env.VERYFI_API_KEY;
  const baseUrl = process.env.VERYFI_TEST_API_BASE_URL ||
    process.env.VERYFI_API_BASE_URL ||
    'https://api.veryfi.com/api/v8/partner';

  if (!clientId || !username || !apiKey) {
    const missing: string[] = [];
    if (!clientId) missing.push('VERYFI_TEST_CLIENT_ID or VERYFI_CLIENT_ID');
    if (!username) missing.push('VERYFI_TEST_USERNAME or VERYFI_USERNAME');
    if (!apiKey) missing.push('VERYFI_TEST_API_KEY or VERYFI_API_KEY');

    throw new Error(
      `Missing required Veryfi test configuration: ${missing.join(', ')}`
    );
  }

  return {
    clientId,
    clientSecret,
    username,
    apiKey,
    baseUrl,
  };
}

/**
 * Get complete integration test environment configuration
 *
 * This function validates that all required environment variables
 * are present for both S3 and Veryfi services.
 *
 * @throws Error if any required environment variables are missing
 */
export function getIntegrationTestEnv(): IntegrationTestEnv {
  return {
    s3: getS3TestConfig(),
    veryfi: getVeryfiTestConfig(),
  };
}

/**
 * Check if integration test environment is properly configured
 *
 * @returns true if all required environment variables are set, false otherwise
 */
export function isIntegrationTestEnvConfigured(): boolean {
  try {
    getIntegrationTestEnv();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Skip integration test if environment is not configured
 *
 * Usage in Jest tests:
 * ```typescript
 * import { skipIfNotConfigured } from './test-env-setup';
 *
 * describe('Integration Tests', () => {
 *   beforeAll(() => {
 *     skipIfNotConfigured();
 *   });
 *
 *   it('should run integration test', () => {
 *     // test code
 *   });
 * });
 * ```
 */
export function skipIfNotConfigured(): void {
  if (!isIntegrationTestEnvConfigured()) {
    console.warn(
      '⚠️  Integration test environment not configured. Skipping tests.\n' +
      '   Set required environment variables to run integration tests.'
    );
    // In Jest, this will skip all tests in the suite
    if (typeof test !== 'undefined' && test.skip) {
      test.skip('Integration tests skipped - environment not configured', () => {});
    }
  }
}
