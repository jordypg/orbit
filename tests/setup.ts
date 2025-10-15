/**
 * Jest test setup
 * Configures test environment and loads environment variables
 */

import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Fallback to .env if .env.test doesn't exist
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

// Set test-specific configurations
process.env.RETRY_DELAY_MULTIPLIER = '0.001'; // Fast retries for tests

// Ensure database URL is set
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Please configure .env or .env.test file.');
  process.exit(1);
}
