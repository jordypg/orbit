/**
 * Document Processing Pipeline Integration Tests
 * End-to-end tests for S3 upload → Veryfi processing → Database storage workflow
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PipelineExecutor } from '../../src/core/executor.js';
import documentProcessingPipeline from '../../src/pipelines/document-processing.js';
import prisma from '../../src/core/prisma.js';
import {
  isIntegrationTestEnvConfigured,
  skipIfNotConfigured,
} from './test-env-setup.js';
import { createS3TestHelper } from './s3-test-helper.js';
import { createVeryfiTestHelper } from './veryfi-test-helper.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Document Processing Pipeline Integration Tests', () => {
  // Skip all tests if environment is not configured
  beforeAll(() => {
    skipIfNotConfigured();
  });

  // Only run tests if environment is configured
  if (!isIntegrationTestEnvConfigured()) {
    it.skip('skipped - environment not configured', () => {});
    return;
  }

  const s3Helper = createS3TestHelper('document-processing-integration');
  const veryfiHelper = createVeryfiTestHelper();
  const createdRunIds: string[] = [];

  // Cleanup after all tests
  afterAll(async () => {
    // Clean up S3 test files
    try {
      await s3Helper.cleanupTestFiles();
    } catch (error: any) {
      console.warn('Failed to cleanup S3 test files:', error.message);
    }

    // Clean up Veryfi test documents
    try {
      await veryfiHelper.cleanupTestDocuments();
    } catch (error: any) {
      console.warn('Failed to cleanup Veryfi test documents:', error.message);
    }

    // Clean up database records
    try {
      for (const runId of createdRunIds) {
        await prisma.veryfiDocument.deleteMany({
          where: { runId },
        });
        await prisma.run.deleteMany({
          where: { id: runId },
        });
      }
    } catch (error: any) {
      console.warn('Failed to cleanup database records:', error.message);
    }

    // Disconnect Prisma
    await prisma.$disconnect();
  }, 60000); // 60 second timeout for cleanup

  describe('Complete Pipeline Flow', () => {
    it('should process a document through S3, Veryfi, and database storage', async () => {
      // Use the test image file from project root
      const testFilePath = path.join(__dirname, '..', '..', 'mapo.png');

      // Create pipeline executor
      const executor = new PipelineExecutor(documentProcessingPipeline);

      // Run the complete pipeline
      const result = await executor.execute({
        metadata: {
          filePath: testFilePath,
          testRun: true,
          integrationTest: true,
        },
      });

      // Track run ID for cleanup
      if (result.runId) {
        createdRunIds.push(result.runId);
      }

      // Verify pipeline completed successfully
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify all steps completed
      const stepResults = result.stepResults || {};
      expect(Object.keys(stepResults).length).toBeGreaterThan(0);

      // Get the pipeline summary step result which contains all the data
      const summaryData = stepResults['pipeline-summary']?.data as any;
      expect(summaryData).toBeDefined();

      // Verify S3 upload
      expect(summaryData.s3).toBeDefined();
      expect(summaryData.s3.bucket).toBeTruthy();
      expect(summaryData.s3.key).toBeTruthy();
      expect(summaryData.s3.url).toBeTruthy();
      expect(summaryData.s3.size).toBeGreaterThan(0);

      // Track S3 file for cleanup (extract key from URL or use the key directly)
      // Note: s3Helper tracks files it uploads, but pipeline uses the service directly
      // We'll let the test run cleanup handle S3 files via the documented runId pattern

      // Verify Veryfi processing
      expect(summaryData.veryfi).toBeDefined();
      expect(summaryData.veryfi.response).toBeDefined();

      const veryfiResponse = summaryData.veryfi.response;

      // Track Veryfi document for cleanup
      if (veryfiResponse.id) {
        veryfiHelper.trackDocument(veryfiResponse.id);
      }

      // Validate Veryfi response structure
      veryfiHelper.validateResponse(veryfiResponse);

      // Extract and verify key fields
      const keyFields = veryfiHelper.extractKeyFields(veryfiResponse);
      expect(keyFields.id).toBeTruthy();

      // Verify database storage
      expect(summaryData.storage).toBeDefined();
      expect(summaryData.storage.documentId).toBeTruthy();
      expect(summaryData.storage.status).toBe('completed');

      // Query database to verify record exists and has correct data
      const dbRecord = await prisma.veryfiDocument.findUnique({
        where: { id: summaryData.storage.documentId },
      });

      expect(dbRecord).toBeDefined();
      expect(dbRecord?.s3Bucket).toBe(summaryData.s3.bucket);
      expect(dbRecord?.s3Key).toBe(summaryData.s3.key);
      expect(dbRecord?.s3Url).toBe(summaryData.s3.url);
      expect(dbRecord?.veryfiId).toBeTruthy();
      expect(dbRecord?.status).toBe('completed');
      expect(dbRecord?.response).toBeDefined();

      // Verify Run association
      if (result.runId) {
        expect(dbRecord?.runId).toBe(result.runId);

        // Verify Run record exists
        const runRecord = await prisma.run.findUnique({
          where: { id: result.runId },
        });
        expect(runRecord).toBeDefined();
        expect(runRecord?.status).toBe('success');
      }
    }, 240000); // 4 minute timeout for complete pipeline execution
  });

  describe('Pipeline Error Handling', () => {
    it.skip('should handle invalid file paths gracefully', async () => {
      // This test would require modifying the pipeline to accept file paths
      // Currently the pipeline expects files to be passed through context
      // Skipping for now as it requires additional implementation
    });

    it.skip('should handle Veryfi API errors gracefully', async () => {
      // This test would require mocking or forcing Veryfi errors
      // Skipping for now as it's complex to set up in integration tests
    });
  });
});
