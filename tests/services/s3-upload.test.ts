/**
 * Unit tests for S3 Upload Service
 * Tests all functions including error scenarios, retry logic, and configuration validation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { s3Upload, type S3UploadContext } from '../../src/services/s3-upload.js';

// Mock AWS SDK
const mockS3Send = jest.fn<any>();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockS3Send,
  })),
  PutObjectCommand: jest.fn().mockImplementation((params) => params),
}));

// Mock fs/promises
const mockStat = jest.fn<any>();
const mockReadFile = jest.fn<any>();
jest.mock('fs/promises', () => ({
  stat: mockStat,
  readFile: mockReadFile,
}));

describe('S3 Upload Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = {
      ...originalEnv,
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test-access-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret-key',
      AWS_S3_BUCKET: 'test-bucket',
    };

    // Clear all mocks
    jest.clearAllMocks();
    mockS3Send.mockReset();
    mockStat.mockReset();
    mockReadFile.mockReset();

    // Default mock implementations
    mockS3Send.mockResolvedValue({});
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Successful Upload Scenarios', () => {
    it('should successfully upload a file to S3', async () => {
      // Mock file operations
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      mockReadFile.mockResolvedValue(Buffer.from('test file content'));

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/test.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.bucket).toBe('test-bucket');
      expect(result.data?.size).toBe(1024);
      expect(result.data?.contentType).toBe('application/pdf');
      expect(result.data?.key).toMatch(/^uploads\//);
      expect(result.data?.url).toContain('s3.us-east-1.amazonaws.com');

      // Verify S3 client was called
      expect(mockS3Send).toHaveBeenCalledTimes(1);
      expect(mockReadFile).toHaveBeenCalledWith('/path/to/test.pdf');
    });

    it('should handle different file types correctly', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 2048,
      });

      mockReadFile.mockResolvedValue(Buffer.from('image data'));

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/image.png',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(true);
      expect(result.data?.contentType).toBe('image/png');
      expect(result.data?.size).toBe(2048);
    });

    it('should use default content type for unknown extensions', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 512,
      });

      mockReadFile.mockResolvedValue(Buffer.from('unknown file'));

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/file.unknown',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(true);
      expect(result.data?.contentType).toBe('application/octet-stream');
    });

    it('should generate unique S3 keys for multiple uploads', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      mockReadFile.mockResolvedValue(Buffer.from('test'));

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/test.pdf',
        },
      };

      // Upload same file twice
      const result1 = await s3Upload(context);
      const result2 = await s3Upload(context);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data?.key).not.toBe(result2.data?.key);
    });
  });

  describe('Error Scenarios', () => {
    it('should fail when filePath is missing', async () => {
      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {},
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No filePath provided in context.metadata');
    });

    it('should handle file not found error (ENOENT)', async () => {
      const enoentError: any = new Error('ENOENT: no such file or directory');
      enoentError.code = 'ENOENT';
      mockStat.mockRejectedValue(enoentError);

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/nonexistent/file.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
      expect(result.error).toContain('/nonexistent/file.pdf');
    });

    it('should handle permission denied error (EACCES)', async () => {
      const eaccesError: any = new Error('EACCES: permission denied');
      eaccesError.code = 'EACCES';
      mockStat.mockRejectedValue(eaccesError);

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/restricted/file.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('permission denied');
    });

    it('should fail when path is not a file', async () => {
      mockStat.mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
      });

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/directory',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Path is not a file');
    });
  });

  describe('Configuration Validation', () => {
    it('should fail when AWS_REGION is missing', async () => {
      delete process.env.AWS_REGION;

      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/test.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required AWS environment variables');
    });

    it('should fail when AWS_ACCESS_KEY_ID is missing', async () => {
      delete process.env.AWS_ACCESS_KEY_ID;

      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/test.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required AWS environment variables');
    });

    it('should fail when AWS_SECRET_ACCESS_KEY is missing', async () => {
      delete process.env.AWS_SECRET_ACCESS_KEY;

      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/test.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required AWS environment variables');
    });

    it('should fail when AWS_S3_BUCKET is missing', async () => {
      delete process.env.AWS_S3_BUCKET;

      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/test.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required environment variable: AWS_S3_BUCKET');
    });
  });

  describe('S3 Upload Failures and Retry Logic', () => {
    it('should retry on S3 upload failure', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      mockReadFile.mockResolvedValue(Buffer.from('test'));

      // Fail first two attempts, succeed on third
      mockS3Send
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockResolvedValueOnce({});

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/test.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(true);
      expect(mockS3Send).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries are exhausted', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      mockReadFile.mockResolvedValue(Buffer.from('test'));

      // Fail all attempts
      mockS3Send.mockRejectedValue(new Error('Permanent S3 failure'));

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/test.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to upload to S3 after 3 attempts');
      expect(result.error).toContain('Permanent S3 failure');
      expect(mockS3Send).toHaveBeenCalledTimes(3);
    });

    it('should handle S3 access denied error', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      mockReadFile.mockResolvedValue(Buffer.from('test'));

      const accessDeniedError: any = new Error('AccessDenied');
      accessDeniedError.name = 'AccessDenied';
      mockS3Send.mockRejectedValue(accessDeniedError);

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/test.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('AccessDenied');
    });

    it('should handle bucket not found error', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      mockReadFile.mockResolvedValue(Buffer.from('test'));

      const bucketNotFoundError: any = new Error('NoSuchBucket');
      bucketNotFoundError.name = 'NoSuchBucket';
      mockS3Send.mockRejectedValue(bucketNotFoundError);

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/test.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('NoSuchBucket');
    });
  });

  describe('File Content Handling', () => {
    it('should handle large files', async () => {
      const largeSize = 100 * 1024 * 1024; // 100MB
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: largeSize,
      });

      mockReadFile.mockResolvedValue(Buffer.alloc(largeSize));

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/large-file.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(true);
      expect(result.data?.size).toBe(largeSize);
    });

    it('should handle empty files', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 0,
      });

      mockReadFile.mockResolvedValue(Buffer.alloc(0));

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/empty.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(true);
      expect(result.data?.size).toBe(0);
    });

    it('should handle file read error', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      mockReadFile.mockRejectedValue(new Error('File read error'));

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/test.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File read error');
    });
  });

  describe('Timeout Handling', () => {
    it('should handle S3 timeout errors', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      mockReadFile.mockResolvedValue(Buffer.from('test'));

      const timeoutError: any = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockS3Send.mockRejectedValue(timeoutError);

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/test.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(false);
      expect(mockS3Send).toHaveBeenCalledTimes(3); // Should retry
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in filename', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      mockReadFile.mockResolvedValue(Buffer.from('test'));

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/file with spaces & special#chars.pdf',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(true);
      expect(result.data?.key).toBeDefined();
    });

    it('should handle files without extensions', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      mockReadFile.mockResolvedValue(Buffer.from('test'));

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/README',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(true);
      expect(result.data?.contentType).toBe('application/octet-stream');
    });

    it('should handle context with additional metadata fields', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      mockReadFile.mockResolvedValue(Buffer.from('test'));

      const context: S3UploadContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
        metadata: {
          filePath: '/path/to/test.pdf',
          customField: 'custom-value',
          userId: 'user-123',
        },
      };

      const result = await s3Upload(context);

      expect(result.success).toBe(true);
    });
  });
});
