/**
 * Unit tests for Veryfi Processing Service
 * Tests all functions including error scenarios, retry logic, and configuration validation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  veryfiProcess,
  type VeryfiProcessContext,
  type VeryfiResponse,
} from '../../src/services/veryfi-processor.js';
import type { S3UploadData } from '../../src/services/s3-upload.js';

// Mock AWS SDK
const mockGetSignedUrl = jest.fn<any>();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// Mock global fetch
const originalFetch = global.fetch;

describe('Veryfi Processing Service', () => {
  const originalEnv = process.env;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    // Reset environment variables
    process.env = {
      ...originalEnv,
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test-access-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret-key',
      VERYFI_CLIENT_ID: 'test-client-id',
      VERYFI_CLIENT_SECRET: 'test-client-secret',
      VERYFI_USERNAME: 'test-username',
      VERYFI_API_KEY: 'test-api-key',
      VERYFI_API_BASE_URL: 'https://api.veryfi.com/api/v8/partner',
      VERYFI_TIMEOUT: '120000',
    };

    // Clear all mocks
    jest.clearAllMocks();
    mockGetSignedUrl.mockReset();

    // Mock S3 pre-signed URL generation
    mockGetSignedUrl.mockResolvedValue('https://s3.amazonaws.com/presigned-url?signature=xyz');

    // Setup fetch mock
    mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = mockFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  const createMockS3Data = (): S3UploadData => ({
    bucket: 'test-bucket',
    key: 'uploads/2024-01-01-uuid-test.pdf',
    url: 'https://test-bucket.s3.us-east-1.amazonaws.com/uploads/test.pdf',
    contentType: 'application/pdf',
    size: 1024,
  });

  const createMockVeryfiResponse = (): VeryfiResponse => ({
    id: 12345,
    status: 'processed',
    vendor: {
      name: 'Test Vendor',
      address: '123 Test St',
    },
    total: 100.00,
    currency_code: 'USD',
  });

  describe('Successful Processing Scenarios', () => {
    it('should successfully process a document via Veryfi API', async () => {
      const s3Data = createMockS3Data();
      const veryfiResponse = createMockVeryfiResponse();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(veryfiResponse),
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.veryfiId).toBe(12345);
      expect(result.data?.s3Bucket).toBe('test-bucket');
      expect(result.data?.s3Key).toBe('uploads/2024-01-01-uuid-test.pdf');
      expect(result.data?.response).toEqual(veryfiResponse);

      // Verify API call was made
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });

    it('should include correct headers in Veryfi API request', async () => {
      const s3Data = createMockS3Data();
      const veryfiResponse = createMockVeryfiResponse();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(veryfiResponse),
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      await veryfiProcess(context);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/documents/'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'CLIENT-ID': 'test-client-id',
            'AUTHORIZATION': 'apikey test-username:test-api-key',
          }),
        })
      );
    });

    it('should send correct body to Veryfi API', async () => {
      const s3Data = createMockS3Data();
      const veryfiResponse = createMockVeryfiResponse();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(veryfiResponse),
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      await veryfiProcess(context);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs?.[1]?.body as string);

      expect(requestBody).toMatchObject({
        file_url: expect.stringContaining('presigned-url'),
        file_name: expect.stringContaining('.pdf'),
        categories: ['Referral'],
        tags: ['pipeline', 'automated', 'referral'],
      });
    });

    it('should handle Veryfi response without id field', async () => {
      const s3Data = createMockS3Data();
      const veryfiResponse = {
        status: 'processing',
        // No id field
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(veryfiResponse),
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(true);
      expect(result.data?.veryfiId).toBeNull();
    });
  });

  describe('Error Scenarios', () => {
    it('should fail when S3 upload data is missing', async () => {
      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {},
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No S3 upload data found in previous step results');
    });

    it('should handle Veryfi API 400 error', async () => {
      const s3Data = createMockS3Data();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({ error: 'Invalid file format' }),
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Veryfi API error');
      expect(result.error).toContain('Invalid file format');
    });

    it('should handle Veryfi API 401 unauthorized error', async () => {
      const s3Data = createMockS3Data();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Unauthorized',
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
      expect(mockFetch).toHaveBeenCalledTimes(2); // Should retry
    });

    it('should handle Veryfi API 500 server error', async () => {
      const s3Data = createMockS3Data();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
      expect(mockFetch).toHaveBeenCalledTimes(2); // Should retry
    });

    it('should handle malformed JSON response', async () => {
      const s3Data = createMockS3Data();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Error',
        text: async () => 'Not valid JSON{{{',
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not valid JSON');
    });
  });

  describe('Configuration Validation', () => {
    it('should fail when VERYFI_CLIENT_ID is missing', async () => {
      delete process.env.VERYFI_CLIENT_ID;

      const s3Data = createMockS3Data();
      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required Veryfi environment variables');
    });

    it('should fail when VERYFI_USERNAME is missing', async () => {
      delete process.env.VERYFI_USERNAME;

      const s3Data = createMockS3Data();
      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required Veryfi environment variables');
    });

    it('should fail when VERYFI_API_KEY is missing', async () => {
      delete process.env.VERYFI_API_KEY;

      const s3Data = createMockS3Data();
      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required Veryfi environment variables');
    });

    it('should use default base URL when VERYFI_API_BASE_URL is not set', async () => {
      delete process.env.VERYFI_API_BASE_URL;

      const s3Data = createMockS3Data();
      const veryfiResponse = createMockVeryfiResponse();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(veryfiResponse),
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      await veryfiProcess(context);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.veryfi.com/api/v8/partner/documents/',
        expect.any(Object)
      );
    });

    it('should use custom base URL when VERYFI_API_BASE_URL is set', async () => {
      process.env.VERYFI_API_BASE_URL = 'https://custom.veryfi.com/api/v8';

      const s3Data = createMockS3Data();
      const veryfiResponse = createMockVeryfiResponse();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(veryfiResponse),
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      await veryfiProcess(context);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.veryfi.com/api/v8/documents/',
        expect.any(Object)
      );
    });

    it('should fail when AWS credentials are missing for S3 client', async () => {
      delete process.env.AWS_REGION;

      const s3Data = createMockS3Data();
      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required AWS environment variables');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on network failure', async () => {
      const s3Data = createMockS3Data();
      const veryfiResponse = createMockVeryfiResponse();

      // Fail first attempt, succeed on second
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(veryfiResponse),
        } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries are exhausted', async () => {
      const s3Data = createMockS3Data();

      // Fail all attempts
      mockFetch.mockRejectedValue(new Error('Persistent network error'));

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to call Veryfi API after 2 attempts');
      expect(result.error).toContain('Persistent network error');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 error but succeed eventually', async () => {
      const s3Data = createMockS3Data();
      const veryfiResponse = createMockVeryfiResponse();

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'Server error',
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(veryfiResponse),
        } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout when API takes too long', async () => {
      const s3Data = createMockS3Data();
      process.env.VERYFI_TIMEOUT = '100'; // 100ms timeout

      // Mock a slow API response
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  text: async () => JSON.stringify(createMockVeryfiResponse()),
                } as Response),
              1000 // Takes 1 second
            );
          })
      );

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Should retry
    });

    it('should respect custom timeout configuration', async () => {
      const s3Data = createMockS3Data();
      const veryfiResponse = createMockVeryfiResponse();
      process.env.VERYFI_TIMEOUT = '60000'; // 60 second timeout

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(veryfiResponse),
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(true);

      // Verify timeout was passed to AbortController (indirectly tested)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should handle AbortError correctly', async () => {
      const s3Data = createMockS3Data();

      const abortError: any = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('AbortError');
      expect(mockFetch).toHaveBeenCalledTimes(2); // Should retry
    });
  });

  describe('Pre-signed URL Generation', () => {
    it('should handle pre-signed URL generation failure', async () => {
      const s3Data = createMockS3Data();

      mockGetSignedUrl.mockRejectedValue(new Error('Failed to generate pre-signed URL'));

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to generate pre-signed URL');
    });
  });

  describe('File Name Extraction', () => {
    it('should extract filename from S3 key', async () => {
      const s3Data = createMockS3Data();
      const veryfiResponse = createMockVeryfiResponse();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(veryfiResponse),
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      await veryfiProcess(context);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs?.[1]?.body as string);

      expect(requestBody.file_name).toBe('2024-01-01-uuid-test.pdf');
    });

    it('should use default filename when S3 key has no filename', async () => {
      const s3Data: S3UploadData = {
        ...createMockS3Data(),
        key: 'uploads/', // No filename
      };
      const veryfiResponse = createMockVeryfiResponse();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(veryfiResponse),
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      await veryfiProcess(context);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs?.[1]?.body as string);

      expect(requestBody.file_name).toBe('document.pdf');
    });
  });

  describe('Edge Cases', () => {
    it('should handle context with additional metadata fields', async () => {
      const s3Data = createMockS3Data();
      const veryfiResponse = createMockVeryfiResponse();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(veryfiResponse),
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
          customData: { foo: 'bar' },
        },
        metadata: {
          customField: 'value',
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(true);
    });

    it('should handle Veryfi response with extensive fields', async () => {
      const s3Data = createMockS3Data();
      const complexVeryfiResponse = {
        id: 99999,
        status: 'processed',
        vendor: {
          name: 'Complex Vendor Corp',
          address: '456 Complex Ave',
          phone: '555-1234',
          category: 'Restaurant',
        },
        line_items: [
          { description: 'Item 1', total: 10.0 },
          { description: 'Item 2', total: 20.0 },
        ],
        total: 30.0,
        tax: 2.4,
        currency_code: 'USD',
        payment_type: 'credit_card',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(complexVeryfiResponse),
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(true);
      expect(result.data?.response).toEqual(complexVeryfiResponse);
    });

    it('should handle empty Veryfi response', async () => {
      const s3Data = createMockS3Data();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({}),
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(true);
      expect(result.data?.veryfiId).toBeNull();
      expect(result.data?.response).toEqual({});
    });
  });

  describe('Database Integration', () => {
    it('should return data suitable for database storage', async () => {
      const s3Data = createMockS3Data();
      const veryfiResponse = createMockVeryfiResponse();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(veryfiResponse),
      } as Response);

      const context: VeryfiProcessContext = {
        runId: 'test-run-id',
        pipelineId: 'test-pipeline-id',
        prevResults: {
          s3Upload: s3Data,
        },
      };

      const result = await veryfiProcess(context);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        veryfiId: expect.any(Number),
        response: expect.any(Object),
        s3Bucket: expect.any(String),
        s3Key: expect.any(String),
        s3Url: expect.any(String),
      });

      // Verify data can be stringified (important for DB storage)
      expect(() => JSON.stringify(result.data)).not.toThrow();
    });
  });
});
