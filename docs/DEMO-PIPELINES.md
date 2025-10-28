# Demonstration Pipelines

This document describes the demonstration pipelines created to test and showcase the pipeline framework's functionality.

## Overview

Two demonstration pipelines have been created:

1. **S3 Error Test Pipeline** - Tests error handling with nonexistent files
2. **Document Processing Pipeline** - Complete workflow: S3 upload → Veryfi processing → Database storage

---

## 1. S3 Error Test Pipeline

**File:** `src/pipelines/s3-error-test-pipeline.ts`
**Test Script:** `scripts/test-s3-error.mjs`

### Purpose

Demonstrates that the S3 upload service correctly handles error scenarios when attempting to upload a nonexistent file.

### Pipeline Steps

1. **upload-nonexistent-file** - Attempts to upload a file that doesn't exist
   - Expected: FAILS with "File not found" error
   - Max retries: 1
   - Timeout: 30 seconds

### Expected Behavior

✅ **Success Criteria (for error test):**
- Pipeline fails at step 1 with clear error message
- Error message includes "File not found" or "ENOENT"
- No AWS API calls are made (file validation happens first)
- Pipeline fails fast without unnecessary retries

### How to Run

```bash
# Build the TypeScript code
npm run build

# Run the error test
node scripts/test-s3-error.mjs
```

### Test Results

The test validates:
- ✓ File validation catches missing files early
- ✓ Error messages are descriptive and actionable
- ✓ Failed steps prevent AWS API calls
- ✓ Pipeline fails fast (fail-fast behavior)

### Example Output

```
✅ Error handling test PASSED!

📋 Test Results:
   ✓ S3 upload step correctly failed
   ✓ Error was properly caught and reported
   ✓ Error message is descriptive and accurate
   ✓ Pipeline failed fast (no unnecessary retries)
   ✓ No AWS API calls made for invalid file

Error Message: S3 upload failed: File not found: /path/to/nonexistent.pdf
```

---

## 2. Document Processing Pipeline

**File:** `src/pipelines/document-processing.ts`
**Test Script:** `scripts/test-document-processing.mjs`

### Purpose

Demonstrates a complete document processing workflow that uploads a document to S3, processes it through the Veryfi API for data extraction, and stores the results in the database.

### Pipeline Steps

1. **s3-upload** - Upload document to S3 bucket
   - Max retries: 3
   - Timeout: 60 seconds
   - Returns: S3 bucket, key, URL, content type, size

2. **veryfi-process** - Process document with Veryfi API
   - Max retries: 2
   - Timeout: 180 seconds (3 minutes)
   - Requires: Previous S3 upload success
   - Returns: Veryfi document ID, processing response, S3 metadata

3. **veryfi-storage** - Store Veryfi results in database
   - Max retries: 2
   - Timeout: 30 seconds
   - Requires: Previous Veryfi processing success
   - Stores: VeryfiDocument record with Run ID association

4. **pipeline-summary** - Verification and summary
   - Validates all steps completed successfully
   - Displays comprehensive pipeline execution summary
   - Returns: Combined data from all steps

### Required Environment Variables

```bash
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your-bucket-name

# Veryfi API Configuration
VERYFI_CLIENT_ID=your_client_id
VERYFI_USERNAME=your_username
VERYFI_API_KEY=your_api_key
VERYFI_API_BASE_URL=https://api.veryfi.com/api/v8/partner  # Optional
VERYFI_TIMEOUT=120000  # Optional, default 120 seconds

# Database (configured via Prisma)
DATABASE_URL=your_database_connection_string
```

### How to Run

```bash
# Build the TypeScript code
npm run build

# Ensure you have a test file (e.g., good_referral.PDF or mapo.png)
# The test script uses mapo.png by default

# Run the document processing test
node scripts/test-document-processing.mjs
```

### Success Flow

1. **S3 Upload:**
   - File validated and uploaded to S3
   - Returns S3 URL and metadata

2. **Veryfi Processing:**
   - Generates pre-signed URL for S3 object
   - Sends document to Veryfi API (Referral category)
   - Returns Veryfi document ID and extracted data

3. **Database Storage:**
   - Creates VeryfiDocument record in database
   - Associates with Run ID for traceability
   - Stores complete Veryfi response JSON

4. **Summary:**
   - Displays complete pipeline execution details
   - Shows data from each step
   - Confirms all steps completed successfully

### Error Handling

Each step validates the previous step's results before proceeding:

```typescript
// Example from veryfi-process step
if (!s3UploadResult || !s3UploadResult.success) {
  return {
    success: false,
    error: `Cannot process document: S3 upload failed - ${errorMsg}`,
  };
}
```

This ensures:
- Failed steps are detected immediately
- Clear error messages propagate through the pipeline
- Downstream steps don't execute if upstream steps fail
- Resources aren't wasted on invalid data

### Example Output

```
📊 Pipeline Execution Summary
══════════════════════════════════════════════════

✅ All steps completed successfully

📦 S3 Upload:
   - Bucket: my-documents
   - Key: uploads/2025-10-25-abc123-mapo.png
   - URL: https://my-documents.s3.us-east-1.amazonaws.com/...
   - Size: 245678 bytes

🔍 Veryfi Processing:
   - Document ID: 123456789
   - Status: completed
   - Vendor: Sample Vendor Inc.

💾 Database Storage:
   - Record ID: cm123abc456def
   - Veryfi ID: 123456789
   - Status: completed
   - Run ID: cm123run789xyz

══════════════════════════════════════════════════
🎉 Document processing pipeline completed successfully!
```

---

## Testing Summary

Both pipelines demonstrate key aspects of the framework:

### S3 Error Test
- **Tests:** Error handling and validation
- **Demonstrates:** Fail-fast behavior, clear error messages
- **Expected Result:** Pipeline FAILS with descriptive error

### Document Processing
- **Tests:** Complete multi-step workflow with external services
- **Demonstrates:** Service integration, data flow, database persistence
- **Expected Result:** Pipeline SUCCEEDS with all steps complete

---

## Next Steps

Additional test scenarios to consider:

1. **S3 Permission Errors**
   - Test with invalid AWS credentials
   - Test with permission denied scenarios

2. **Veryfi API Errors**
   - Test with invalid API credentials
   - Test with unsupported file formats
   - Test API timeout scenarios

3. **Database Errors**
   - Test with invalid Run ID references
   - Test duplicate document scenarios

4. **End-to-End Integration**
   - Test with various document types (PDF, PNG, JPG)
   - Test large file uploads
   - Test concurrent pipeline executions

---

## Files Reference

### Pipeline Definitions
- `src/pipelines/s3-error-test-pipeline.ts` - Error test pipeline
- `src/pipelines/document-processing.ts` - Complete workflow pipeline

### Services
- `src/services/s3-upload.ts` - S3 upload service
- `src/services/veryfi-processor.ts` - Veryfi API processing
- `src/services/veryfi-storage.ts` - Database storage service

### Test Scripts
- `scripts/test-s3-error.mjs` - S3 error test runner
- `scripts/test-document-processing.mjs` - Document processing test runner

### Database Schema
- `prisma/schema.prisma` - VeryfiDocument model definition

---

## Troubleshooting

### S3 Upload Fails
- Check AWS credentials in `.env`
- Verify S3 bucket exists and is accessible
- Confirm file path is correct and file exists

### Veryfi Processing Fails
- Verify Veryfi API credentials
- Check API quota/limits
- Ensure document format is supported
- Verify pre-signed URL is accessible

### Database Storage Fails
- Check database connection string
- Run Prisma migrations: `npx prisma migrate dev`
- Verify VeryfiDocument model exists
- Check Run ID is valid (if provided)

### Build Errors
```bash
# Clean build
rm -rf dist/
npm run build

# Check TypeScript version
npx tsc --version
```
