/**
 * Document Processing Pipeline
 *
 * Complete workflow for processing documents through three services:
 * 1. S3 Upload: Uploads document to S3 bucket with automatic retry
 * 2. Veryfi Processing: Sends S3 document to Veryfi API for data extraction (Referral category)
 * 3. Database Storage: Stores Veryfi results in VeryfiDocument table with Run ID association
 *
 * Configuration:
 * - S3 upload: 3 retries, 60s timeout
 * - Veryfi processing: 2 retries, 3min timeout (includes API processing time)
 * - Database storage: 2 retries, 30s timeout
 *
 * Error Handling:
 * - Each step validates previous step results before proceeding
 * - Failed steps return detailed error messages with context
 * - All steps support automatic retry with exponential backoff
 */

import { definePipeline, step } from '../core/index.js';
import { s3Upload } from '../services/s3-upload.js';
import { veryfiProcess } from '../services/veryfi-processor.js';
import { veryfiStorage } from '../services/veryfi-storage.js';
import type { StepContext, StepResult } from '../core/types.js';
import type { S3UploadData } from '../services/s3-upload.js';
import type { VeryfiProcessData } from '../services/veryfi-processor.js';
import type { VeryfiStorageData } from '../services/veryfi-storage.js';

export default definePipeline({
    name: 'document-processing',
    description: 'Upload document to S3, process with Vision Model API, and store results in database',

    steps: [
        // Step 1: Upload document to S3
        step('s3-upload', s3Upload, {
            maxRetries: 3,
            timeout: 60000, // 60 seconds
        }),

        // Step 2: Process document with Vision Model API
        step('visionmodel-analysis', async (ctx: StepContext) => {
            console.log('📄 Starting Vision Model processing step...');

            // Map s3-upload result to expected s3Upload key for veryfiProcess service
            const s3UploadResult = ctx.prevResults['s3-upload'] as any;

            if (!s3UploadResult || !s3UploadResult.success) {
                const errorMsg = s3UploadResult?.error || 'No S3 upload data available';
                console.error(`❌ Veryfi processing aborted: S3 upload failed - ${errorMsg}`);
                return {
                    success: false,
                    error: `Cannot process document: S3 upload failed - ${errorMsg}`,
                };
            }

            const s3Data = s3UploadResult.data as S3UploadData;
            console.log(`  ✓ S3 upload data retrieved: ${s3Data.key}`);

            // Create context with properly mapped prevResults for veryfiProcess
            const veryfiContext = {
                ...ctx,
                prevResults: {
                    ...ctx.prevResults,
                    s3Upload: s3Data,
                },
            };

            return await veryfiProcess(veryfiContext);
        }, {
            maxRetries: 2,
            timeout: 180000, // 3 minutes for Veryfi API processing
        }),

        // Step 3: Store extracted data in database
        step('extracted-data-storage', async (ctx: StepContext) => {
            console.log('💾 Starting database storage step...');

            // Map visionmodel-analysis result to expected veryfiProcess key for veryfiStorage service
            const veryfiProcessResult = ctx.prevResults['visionmodel-analysis'] as any;

            if (!veryfiProcessResult || !veryfiProcessResult.success) {
                const errorMsg = veryfiProcessResult?.error || 'No Veryfi processing data available';
                console.error(`❌ Database storage aborted: Veryfi processing failed - ${errorMsg}`);
                return {
                    success: false,
                    error: `Cannot store document: Veryfi processing failed - ${errorMsg}`,
                };
            }

            const veryfiData = veryfiProcessResult.data as VeryfiProcessData;
            console.log(`  ✓ Veryfi processing data retrieved: Document ID ${veryfiData.veryfiId || 'N/A'}`);

            // Create context with properly mapped prevResults for veryfiStorage
            const storageContext = {
                ...ctx,
                prevResults: {
                    ...ctx.prevResults,
                    veryfiProcess: veryfiData,
                },
            };

            return await veryfiStorage(storageContext);
        }, {
            maxRetries: 2,
            timeout: 30000, // 30 seconds for database operations
        }),

        // Step 4: Verify complete pipeline execution and provide summary
        step('pipeline-summary', async (ctx: StepContext): Promise<StepResult> => {
            console.log('\n📊 Pipeline Execution Summary');
            console.log('═'.repeat(50));

            const s3Result = ctx.prevResults['s3-upload'] as any;
            const veryfiResult = ctx.prevResults['visionmodel-analysis'] as any;
            const storageResult = ctx.prevResults['extracted-data-storage'] as any;

            // Verify all steps completed successfully
            const allSuccessful =
                s3Result?.success &&
                veryfiResult?.success &&
                storageResult?.success;

            if (!allSuccessful) {
                console.error('❌ Pipeline completed with errors:');
                if (!s3Result?.success) console.error('  - S3 Upload: FAILED');
                if (!veryfiResult?.success) console.error('  - Veryfi Processing: FAILED');
                if (!storageResult?.success) console.error('  - Database Storage: FAILED');

                return {
                    success: false,
                    error: 'Pipeline completed with one or more failed steps',
                };
            }

            // Extract data from each step
            const s3Data = s3Result.data as S3UploadData;
            const veryfiData = veryfiResult.data as VeryfiProcessData;
            const storageData = storageResult.data as VeryfiStorageData;

            // Display summary
            console.log('✅ All steps completed successfully\n');
            console.log('📦 S3 Upload:');
            console.log(`   - Bucket: ${s3Data.bucket}`);
            console.log(`   - Key: ${s3Data.key}`);
            console.log(`   - URL: ${s3Data.url}`);
            console.log(`   - Size: ${s3Data.size} bytes\n`);

            console.log('🔍 Veryfi Processing:');
            console.log(`   - Document ID: ${veryfiData.veryfiId || 'N/A'}`);
            console.log(`   - Status: ${veryfiData.response.status || 'N/A'}`);
            console.log(`   - Vendor: ${veryfiData.response.vendor?.name || 'N/A'}\n`);

            console.log('💾 Database Storage:');
            console.log(`   - Record ID: ${storageData.documentId}`);
            console.log(`   - Veryfi ID: ${storageData.veryfiId || 'N/A'}`);
            console.log(`   - Status: ${storageData.status}`);
            if (ctx.runId) {
                console.log(`   - Run ID: ${ctx.runId}`);
            }

            console.log('\n' + '═'.repeat(50));
            console.log('🎉 Document processing pipeline completed successfully!\n');

            return {
                success: true,
                data: {
                    s3: s3Data,
                    veryfi: veryfiData,
                    storage: storageData,
                    pipelineRunId: ctx.runId,
                    completedAt: new Date().toISOString(),
                },
            };
        }),
    ],
});
