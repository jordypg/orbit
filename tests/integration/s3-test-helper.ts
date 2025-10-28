/**
 * S3 Test Helper
 * Utilities for managing S3 test artifacts in integration tests
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { getS3TestConfig } from './test-env-setup.js';

/**
 * S3 Test Helper Class
 * Manages test file uploads, downloads, and cleanup in S3
 */
export class S3TestHelper {
  private client: S3Client;
  private bucket: string;
  private testPrefix: string;
  private uploadedKeys: Set<string>;

  /**
   * Create a new S3 Test Helper
   *
   * @param testRunId - Unique identifier for this test run (used to prefix all keys)
   */
  constructor(testRunId?: string) {
    const config = getS3TestConfig();

    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    this.bucket = config.bucket;
    this.testPrefix = `integration-test/${testRunId || Date.now()}/`;
    this.uploadedKeys = new Set();
  }

  /**
   * Generate a unique test file key
   *
   * @param filename - Original filename
   * @returns S3 key with test prefix
   */
  private generateTestKey(filename: string): string {
    const timestamp = Date.now();
    const basename = path.basename(filename);
    return `${this.testPrefix}${timestamp}-${basename}`;
  }

  /**
   * Upload a test file to S3
   *
   * @param filePath - Local path to file
   * @returns S3 key and URL of uploaded file
   */
  async uploadTestFile(filePath: string): Promise<{
    key: string;
    url: string;
    size: number;
  }> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Test file not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath);
    const key = this.generateTestKey(filePath);
    const stats = fs.statSync(filePath);

    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.pdf': 'application/pdf',
    };
    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
      })
    );

    this.uploadedKeys.add(key);

    const url = `https://${this.bucket}.s3.amazonaws.com/${key}`;

    return {
      key,
      url,
      size: stats.size,
    };
  }

  /**
   * Download a test file from S3
   *
   * @param key - S3 key of file to download
   * @param destPath - Local destination path
   */
  async downloadTestFile(key: string, destPath: string): Promise<void> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error(`No body in S3 response for key: ${key}`);
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Ensure destination directory exists
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(destPath, buffer);
  }

  /**
   * List all test files uploaded by this helper
   *
   * @returns Array of S3 keys
   */
  async listTestFiles(): Promise<string[]> {
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.testPrefix,
      })
    );

    return response.Contents?.map((obj) => obj.Key!) || [];
  }

  /**
   * Delete a specific test file
   *
   * @param key - S3 key to delete
   */
  async deleteTestFile(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    this.uploadedKeys.delete(key);
  }

  /**
   * Clean up all test files uploaded by this helper
   *
   * This should be called in test cleanup (afterAll/afterEach)
   */
  async cleanupTestFiles(): Promise<void> {
    const keys = await this.listTestFiles();

    if (keys.length === 0) {
      return;
    }

    // S3 allows deleting up to 1000 objects at once
    const batchSize = 1000;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);

      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: batch.map((key) => ({ Key: key })),
          },
        })
      );
    }

    this.uploadedKeys.clear();
  }

  /**
   * Get test bucket name
   */
  getBucket(): string {
    return this.bucket;
  }

  /**
   * Get test prefix
   */
  getPrefix(): string {
    return this.testPrefix;
  }
}

/**
 * Create a new S3 Test Helper with a unique test run ID
 *
 * @param testName - Optional test name to include in prefix
 * @returns New S3TestHelper instance
 */
export function createS3TestHelper(testName?: string): S3TestHelper {
  const testRunId = testName
    ? `${testName.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}`
    : `test-${Date.now()}`;

  return new S3TestHelper(testRunId);
}
