/**
 * Veryfi Storage Service
 * Reusable service for storing Veryfi response data in the database
 */

import prisma from '../core/prisma.js';
import type { StepResult, StepContext } from '../core/types.js';
import type { VeryfiProcessData } from './veryfi-processor.js';

/**
 * Veryfi Storage Result Data
 */
export interface VeryfiStorageData {
  documentId: string;
  veryfiId: string | null;
  status: string;
}

/**
 * Veryfi Storage Service Context
 */
export interface VeryfiStorageContext extends StepContext {
  prevResults: {
    veryfiProcess?: VeryfiProcessData;
    [key: string]: any;
  };
}

/**
 * Validate Veryfi response structure
 */
function validateVeryfiResponse(response: any): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }

  // Response should be a valid JSON object
  // Veryfi responses typically have some core fields, but structure can vary
  return true;
}

/**
 * Extract status from Veryfi response
 */
function extractStatus(response: any): string {
  // Default status is 'completed' if we successfully processed
  if (response?.status) {
    return response.status;
  }
  return 'completed';
}

/**
 * Veryfi Storage Service Handler
 *
 * Stores Veryfi API response data in the MedicalDocument table
 *
 * @param context - Step context containing Veryfi processing results
 * @returns StepResult with document ID
 */
export async function veryfiStorage(
  context: VeryfiStorageContext
): Promise<StepResult<VeryfiStorageData>> {
  try {
    // Get Veryfi processing results from previous step
    const veryfiData = context.prevResults.veryfiProcess;
    if (!veryfiData) {
      return {
        success: false,
        error: 'No Veryfi processing data found in previous step results',
      };
    }

    console.log(`💾 Starting Veryfi storage for document: ${veryfiData.veryfiId || 'N/A'}`);

    // Validate Veryfi response
    if (!validateVeryfiResponse(veryfiData.response)) {
      return {
        success: false,
        error: 'Invalid Veryfi response structure',
      };
    }

    console.log('  ✓ Veryfi response validated');

    // Extract status from response
    const status = extractStatus(veryfiData.response);
    console.log(`  ✓ Document status: ${status}`);

    // Prepare database record
    const documentData: any = {
      veryfiId: veryfiData.veryfiId ? String(veryfiData.veryfiId) : null,
      s3Bucket: veryfiData.s3Bucket,
      s3Key: veryfiData.s3Key,
      s3Url: veryfiData.s3Url,
      status,
      response: veryfiData.response as any, // Prisma Json type
    };

    // Only add runId if it exists
    if (context.runId) {
      documentData.runId = context.runId;
    }

    console.log('  📝 Creating database record...');

    // Store in database
    const document = await prisma.medicalDocument.create({
      data: documentData,
    });

    console.log(`  ✓ Database record created with ID: ${document.id}`);

    const result: VeryfiStorageData = {
      documentId: document.id,
      veryfiId: document.veryfiId,
      status: document.status,
    };

    console.log(`✅ Veryfi storage complete`);
    console.log(`   Document ID: ${result.documentId}`);
    console.log(`   Veryfi ID: ${result.veryfiId || 'N/A'}`);
    console.log(`   Status: ${result.status}`);

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    console.error(`❌ Veryfi storage failed:`, error.message);

    // Handle specific database errors
    if (error.code === 'P2002') {
      return {
        success: false,
        error: 'Duplicate document already exists in database',
      };
    }

    if (error.code === 'P2003') {
      return {
        success: false,
        error: 'Invalid runId reference',
      };
    }

    return {
      success: false,
      error: `Veryfi storage failed: ${error.message}`,
    };
  }
}

export default veryfiStorage;
