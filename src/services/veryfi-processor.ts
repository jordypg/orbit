/**
 * Veryfi Processing Service
 * Sends S3 documents to Veryfi API for data extraction
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StepResult, StepContext } from '../core/types.js';
import type { S3UploadData } from './s3-upload.js';

/**
 * Veryfi API Response (simplified - actual response has many more fields)
 */
export interface VeryfiResponse {
  id?: number;
  status?: string;
  vendor?: {
    name?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Veryfi Processing Result Data
 */
export interface VeryfiProcessData {
  veryfiId: number | null;
  response: VeryfiResponse;
  s3Bucket: string;
  s3Key: string;
  s3Url: string;
}

/**
 * Veryfi Processing Context
 */
export interface VeryfiProcessContext extends StepContext {
  prevResults: {
    s3Upload?: S3UploadData;
    [key: string]: any;
  };
}

/**
 * Get Veryfi credentials from environment
 */
function getVeryfiCredentials() {
  const clientId = process.env.VERYFI_CLIENT_ID;
  const clientSecret = process.env.VERYFI_CLIENT_SECRET;
  const username = process.env.VERYFI_USERNAME;
  const apiKey = process.env.VERYFI_API_KEY;

  if (!clientId || !username || !apiKey) {
    throw new Error(
      'Missing required Veryfi environment variables: VERYFI_CLIENT_ID, VERYFI_USERNAME, VERYFI_API_KEY'
    );
  }

  return {
    clientId,
    clientSecret,
    username,
    apiKey,
  };
}

/**
 * Get Veryfi API configuration from environment
 */
function getVeryfiConfig() {
  const baseUrl = process.env.VERYFI_API_BASE_URL || 'https://api.veryfi.com/api/v8/partner';
  const timeout = parseInt(process.env.VERYFI_TIMEOUT || '120000', 10);

  return {
    baseUrl,
    timeout,
  };
}

/**
 * Create S3 client for pre-signed URL generation
 */
function createS3Client(): S3Client {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing required AWS environment variables for S3 client'
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
 * Generate pre-signed URL for S3 object
 */
async function generatePresignedUrl(
  bucket: string,
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = createS3Client();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const presignedUrl = await getSignedUrl(client, command, { expiresIn });
  return presignedUrl;
}

/**
 * Call Veryfi API with retry logic
 */
async function callVeryfiAPI(
  presignedUrl: string,
  fileName: string,
  credentials: ReturnType<typeof getVeryfiCredentials>,
  config: ReturnType<typeof getVeryfiConfig>,
  maxRetries: number = 2
): Promise<VeryfiResponse> {
  const apiUrl = `${config.baseUrl}/documents/`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'CLIENT-ID': credentials.clientId,
    'AUTHORIZATION': `apikey ${credentials.username}:${credentials.apiKey}`,
  };

  const body = {
    file_url: presignedUrl,
    file_name: fileName,
    categories: ['Referral'],
    tags: ['pipeline', 'automated', 'referral'],
  };

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();

      if (!response.ok) {
        let errorMessage = `Veryfi API error: ${response.status} ${response.statusText}`;
        try {
          const errorJson = JSON.parse(responseText);
          errorMessage = `Veryfi API error: ${JSON.stringify(errorJson)}`;
        } catch {
          errorMessage = `Veryfi API error: ${responseText}`;
        }
        throw new Error(errorMessage);
      }

      const data = JSON.parse(responseText);
      return data;
    } catch (error: any) {
      lastError = error;

      if (error.name === 'AbortError') {
        console.error(`Veryfi API attempt ${attempt}/${maxRetries} timed out after ${config.timeout}ms`);
      } else {
        console.error(`Veryfi API attempt ${attempt}/${maxRetries} failed:`, error.message);
      }

      if (attempt < maxRetries) {
        // Wait before retry
        const delay = Math.min(2000 * attempt, 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to call Veryfi API after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Veryfi Processing Service Handler
 *
 * Processes S3-stored document via Veryfi API and returns extracted data
 *
 * @param context - Step context containing S3 upload results
 * @returns StepResult with Veryfi response data
 */
export async function veryfiProcess(
  context: VeryfiProcessContext
): Promise<StepResult<VeryfiProcessData>> {
  try {
    // Get S3 upload results from previous step
    const s3Data = context.prevResults.s3Upload;
    if (!s3Data) {
      return {
        success: false,
        error: 'No S3 upload data found in previous step results',
      };
    }

    console.log(`📄 Starting Veryfi processing for S3 object: ${s3Data.key}`);

    // Generate pre-signed URL
    console.log('  🔗 Generating pre-signed S3 URL...');
    const presignedUrl = await generatePresignedUrl(s3Data.bucket, s3Data.key);
    console.log('  ✓ Pre-signed URL generated (valid for 1 hour)');

    // Get Veryfi credentials and config
    const credentials = getVeryfiCredentials();
    const config = getVeryfiConfig();
    console.log('  ✓ Veryfi credentials loaded');

    // Extract filename from S3 key
    const fileName = s3Data.key.split('/').pop() || 'document.pdf';

    // Call Veryfi API
    console.log('  📤 Sending request to Veryfi API...');
    const veryfiResponse = await callVeryfiAPI(
      presignedUrl,
      fileName,
      credentials,
      config
    );
    console.log('  ✓ Veryfi API response received');

    const data: VeryfiProcessData = {
      veryfiId: veryfiResponse.id || null,
      response: veryfiResponse,
      s3Bucket: s3Data.bucket,
      s3Key: s3Data.key,
      s3Url: s3Data.url,
    };

    console.log(`✅ Veryfi processing complete`);
    console.log(`   Document ID: ${data.veryfiId || 'N/A'}`);
    console.log(`   Status: ${veryfiResponse.status || 'N/A'}`);

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error(`❌ Veryfi processing failed:`, error.message);
    return {
      success: false,
      error: `Veryfi processing failed: ${error.message}`,
    };
  }
}

export default veryfiProcess;
