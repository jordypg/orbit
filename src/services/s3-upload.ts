/**
 * S3 Upload Service
 * Reusable service for uploading files to AWS S3
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile, stat } from 'fs/promises';
import { randomUUID } from 'crypto';
import { extname, basename } from 'path';
import mime from 'mime-types';
import type { StepResult, StepContext } from '../core/types.js';

/**
 * S3 Upload Result Data
 */
export interface S3UploadData {
  bucket: string;
  key: string;
  url: string;
  contentType: string;
  size: number;
}

/**
 * S3 Upload Service Context
 */
export interface S3UploadContext extends StepContext {
  filePath?: string;
  metadata?: {
    filePath?: string;
  };
}

/**
 * Create S3 client from environment variables
 */
function createS3Client(): S3Client {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing required AWS environment variables: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY'
    );
  }

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Get S3 bucket from environment
 */
function getS3Bucket(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error('Missing required environment variable: AWS_S3_BUCKET');
  }
  return bucket;
}

/**
 * Validate file exists and get stats
 */
async function validateFile(filePath: string): Promise<{ size: number }> {
  try {
    const stats = await stat(filePath);

    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    return { size: stats.size };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    throw error;
  }
}

/**
 * Detect content type from file extension
 */
function detectContentType(filePath: string): string {
  const contentType = mime.lookup(filePath);
  if (!contentType) {
    // Default to application/octet-stream for unknown types
    return 'application/octet-stream';
  }
  return contentType;
}

/**
 * Generate unique S3 key with timestamp and UUID
 */
function generateS3Key(filePath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const uuid = randomUUID();
  const ext = extname(filePath);
  const baseName = basename(filePath, ext);

  return `uploads/${timestamp}-${uuid}-${baseName}${ext}`;
}

/**
 * Upload file to S3 with retry logic
 */
async function uploadToS3(
  client: S3Client,
  bucket: string,
  key: string,
  filePath: string,
  contentType: string,
  maxRetries: number = 3
): Promise<void> {
  const fileContent = await readFile(filePath);

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
      });

      await client.send(command);
      return; // Success!
    } catch (error: any) {
      lastError = error;
      console.error(`S3 upload attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to upload to S3 after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * S3 Upload Service Handler
 *
 * Uploads a local file to S3 and returns metadata
 *
 * @param context - Step context containing filePath
 * @returns StepResult with S3 upload data
 */
export async function s3Upload(context: S3UploadContext): Promise<StepResult<S3UploadData>> {
  try {
    // Get file path from context
    const filePath = context.metadata?.filePath;
    if (!filePath) {
      return {
        success: false,
        error: 'No filePath provided in context.metadata',
      };
    }

    console.log(`📤 Starting S3 upload for: ${filePath}`);

    // Validate file exists
    const { size } = await validateFile(filePath);
    console.log(`  ✓ File validated (${size} bytes)`);

    // Detect content type
    const contentType = detectContentType(filePath);
    console.log(`  ✓ Content type: ${contentType}`);

    // Generate unique S3 key
    const key = generateS3Key(filePath);
    console.log(`  ✓ Generated S3 key: ${key}`);

    // Get bucket and create client
    const bucket = getS3Bucket();
    const client = createS3Client();
    console.log(`  ✓ S3 client configured for bucket: ${bucket}`);

    // Upload to S3 with retries
    await uploadToS3(client, bucket, key, filePath, contentType);
    console.log(`  ✓ File uploaded successfully`);

    // Construct S3 URL
    const region = process.env.AWS_REGION;
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    const data: S3UploadData = {
      bucket,
      key,
      url,
      contentType,
      size,
    };

    console.log(`✅ S3 upload complete: ${url}`);

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error(`❌ S3 upload failed:`, error.message);
    return {
      success: false,
      error: `S3 upload failed: ${error.message}`,
    };
  }
}

export default s3Upload;
