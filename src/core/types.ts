/**
 * Pipeline Type Definitions
 * Core TypeScript interfaces for the pipeline execution system
 */

/**
 * Context provided to each step during pipeline execution
 * Contains all information needed for a step to execute
 */
export interface StepContext<TPrevResults = Record<string, unknown>> {
  /** Unique identifier for the current run */
  runId: string;

  /** Unique identifier for the pipeline being executed */
  pipelineId: string;

  /** Results from all previous steps in the pipeline */
  prevResults: TPrevResults;

  /** Additional metadata about the run (e.g., trigger source, user info) */
  metadata?: Record<string, unknown>;
}

/**
 * Result returned by a step handler function
 * Indicates success/failure and provides data or error information
 */
export interface StepResult<TData = unknown> {
  /** Whether the step executed successfully */
  success: boolean;

  /** Data returned by the step (available to subsequent steps) */
  data?: TData;

  /** Error message if step failed */
  error?: string;
}

/**
 * Function signature for a step handler
 * Receives context and returns a result (sync or async)
 */
export type StepHandler<TContext = StepContext, TResult = unknown> = (
  context: TContext
) => Promise<StepResult<TResult>> | StepResult<TResult>;

/**
 * Definition of a single step in a pipeline
 */
export interface StepDefinition {
  /** Unique name for the step within the pipeline */
  name: string;

  /** Handler function that executes the step logic */
  handler: StepHandler;

  /** Optional configuration for the step */
  config?: {
    /** Maximum number of retry attempts (default: 0) */
    maxRetries?: number;

    /** Timeout in milliseconds (default: no timeout) */
    timeout?: number;

    /**
     * List of step names this step depends on.
     * If not specified, step depends on all previous steps (sequential execution).
     * If specified, step will execute as soon as all dependencies complete.
     * Enables parallel execution of independent steps.
     * @example
     * // These two steps will run in parallel after 'fetch-data' completes:
     * step('analyze-alpha', handler, { dependsOn: ['fetch-data'] })
     * step('analyze-beta', handler, { dependsOn: ['fetch-data'] })
     */
    dependsOn?: string[];
  };
}

/**
 * Complete pipeline definition with metadata and steps
 */
export interface PipelineDefinition {
  /** Unique name for the pipeline */
  name: string;

  /** Human-readable description of the pipeline's purpose */
  description?: string;

  /** Ordered array of step definitions to execute */
  steps: StepDefinition[];

  /** Optional cron schedule for automatic execution */
  schedule?: string;
}

/**
 * Options for defining a new pipeline
 */
export interface DefinePipelineOptions {
  /** Unique name for the pipeline */
  name: string;

  /** Human-readable description of the pipeline's purpose */
  description?: string;

  /** Optional cron schedule for automatic execution */
  schedule?: string;

  /** Array of step definitions */
  steps: StepDefinition[];
}

/**
 * Options for creating a step definition
 */
export interface StepOptions {
  /** Maximum number of retry attempts (default: 0) */
  maxRetries?: number;

  /** Timeout in milliseconds (default: no timeout) */
  timeout?: number;

  /**
   * List of step names this step depends on.
   * If not specified, step depends on all previous steps (sequential execution).
   * If specified, step will execute as soon as all dependencies complete.
   */
  dependsOn?: string[];
}

/**
 * S3 Upload Service Types
 */

/**
 * Result data from S3 upload operation
 */
export interface S3UploadData {
  /** S3 bucket name */
  bucket: string;

  /** S3 object key (path within bucket) */
  key: string;

  /** Full S3 URL to the uploaded file */
  url: string;

  /** MIME content type of the uploaded file */
  contentType: string;

  /** File size in bytes */
  size: number;
}

/**
 * S3 upload operation result as specified in PRD
 * Enhanced version with additional metadata and standardized field names
 *
 * @example
 * ```typescript
 * import type { S3UploadResult, StepResult } from './types.js';
 *
 * const uploadResult: StepResult<S3UploadResult> = {
 *   success: true,
 *   data: {
 *     s3Url: 'https://bucket.s3.us-east-1.amazonaws.com/uploads/file.pdf',
 *     s3Key: 'uploads/2024-01-01-uuid-file.pdf',
 *     bucket: 'my-bucket',
 *     originalPath: '/local/path/to/file.pdf',
 *     contentType: 'application/pdf',
 *     size: 1024000,
 *     uploadedAt: new Date()
 *   }
 * };
 * ```
 */
export interface S3UploadResult {
  /** Full S3 URL to the uploaded file */
  s3Url: string;

  /** S3 object key (path within bucket) */
  s3Key: string;

  /** S3 bucket name */
  bucket: string;

  /** Original local file path that was uploaded */
  originalPath: string;

  /** MIME content type of the uploaded file */
  contentType: string;

  /** File size in bytes */
  size: number;

  /** Timestamp when the upload was completed */
  uploadedAt: Date;
}

/**
 * Veryfi Service Types
 */

/**
 * Veryfi document processing status
 */
export type VeryfiProcessingStatus =
  | 'pending'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'reviewed'
  | string; // Allow additional status values

/**
 * Veryfi vendor information
 */
export interface VeryfiVendor {
  /** Cleaned vendor name from Veryfi's database */
  name?: string;

  /** Raw vendor name as extracted from document */
  raw_name?: string;

  /** Vendor business address */
  address?: string;

  /** Vendor contact phone number */
  phone_number?: string;

  /** Vendor email address */
  email?: string;

  /** Vendor VAT/tax number */
  vat_number?: string;

  /** Vendor business category/type */
  category?: string;

  /** Vendor latitude coordinate */
  lat?: number;

  /** Vendor longitude coordinate */
  lng?: number;

  /** Vendor logo URL */
  logo?: string;

  /** Map URL for vendor location */
  map_url?: string;

  /** Vendor website */
  web?: string;

  /** Vendor ABN (Australian Business Number) */
  abn_number?: string;

  /** Vendor account number */
  account_number?: string;

  /** Vendor bank name */
  bank_name?: string;

  /** Vendor bank routing number */
  bank_number?: string;

  /** Vendor bank SWIFT code */
  bank_swift?: string;

  /** Vendor IBAN */
  iban?: string;

  /** Vendor registration number */
  reg_number?: string;

  /** Vendor type classification */
  type?: string;

  /** Vendor fax number */
  fax_number?: string;

  /** External IDs associated with vendor */
  external_ids?: string[];
}

/**
 * Veryfi line item structure
 */
export interface VeryfiLineItem {
  /** Unique line item identifier */
  id?: number;

  /** Order/position in the list */
  order?: number;

  /** Raw text for the line item */
  text?: string;

  /** Line item type (product, service, food, discount, etc.) */
  type?: string;

  /** Product or service description */
  description?: string;

  /** Quantity of items */
  quantity?: number | null;

  /** Unit price */
  price?: number | null;

  /** Line total amount */
  total?: number | null;

  /** Tax amount for this line */
  tax?: number | null;

  /** Discount amount */
  discount?: number | null;

  /** Stock keeping unit (SKU) */
  sku?: string | null;

  /** Product category */
  category?: string | null;

  /** Associated tags */
  tags?: string[];
}

/**
 * Veryfi API response structure for any-documents endpoint
 * Comprehensive interface covering all common Veryfi response fields
 */
export interface VeryfiApiResponse {
  /** Veryfi's unique document ID */
  id?: number;

  /** External ID provided during submission */
  external_id?: string | null;

  /** Document processing status */
  status?: VeryfiProcessingStatus;

  /** Document type classification */
  document_type?: 'receipt' | 'invoice' | 'purchase_order' | 'check' | 'w9' | 'w2' | 'statement' | 'other' | string;

  /** Document creation timestamp */
  created_date?: string;

  /** Last update timestamp */
  updated_date?: string;

  /** ISO 4217 currency code */
  currency_code?: string;

  /** Grand total amount */
  total?: number;

  /** Subtotal amount (before tax and fees) */
  subtotal?: number;

  /** Total tax amount */
  tax?: number;

  /** Tip amount */
  tip?: number;

  /** Discount amount */
  discount?: number;

  /** Shipping/delivery cost */
  shipping?: number;

  /** Rounding adjustment */
  rounding?: number;

  /** Cash withdrawn during purchase */
  cashback?: number;

  /** Document issue or transaction date */
  date?: string;

  /** Due date for payment */
  due_date?: string;

  /** Vendor/provider information */
  vendor?: VeryfiVendor;

  /** Array of line items extracted from document */
  line_items?: VeryfiLineItem[];

  /** Tax line items */
  tax_lines?: Array<{
    name?: string;
    rate?: number;
    total?: number;
    order?: number;
  }>;

  /** Invoice number */
  invoice_number?: string | null;

  /** Purchase order number */
  purchase_order_number?: string | null;

  /** Generic document reference number */
  document_reference_number?: string | null;

  /** Shipment tracking number */
  tracking_number?: string | null;

  /** Bill to/customer name */
  bill_to_name?: string | null;

  /** Bill to address */
  bill_to_address?: string | null;

  /** Ship to name */
  ship_to_name?: string | null;

  /** Ship to address */
  ship_to_address?: string | null;

  /** Payment type/method */
  payment_type?: string | null;

  /** Payment display name */
  payment_display_name?: string | null;

  /** Account number (masked) */
  account_number?: string | null;

  /** Image URL */
  img_url?: string;

  /** PDF URL */
  pdf_url?: string;

  /** Thumbnail image URL */
  img_thumbnail_url?: string;

  /** Original filename */
  img_file_name?: string | null;

  /** OCR extracted text */
  ocr_text?: string | null;

  /** OCR confidence score (0-1) */
  ocr_score?: number;

  /** Notes or comments */
  notes?: string | null;

  /** Associated tags */
  tags?: Array<{
    id?: number;
    name?: string;
  }>;

  /** Custom fields */
  custom_fields?: Record<string, any>;

  /** Metadata object */
  meta?: Record<string, any>;

  /** Model/blueprint used for extraction */
  model?: string | null;

  /** Blueprint name used for extraction */
  blueprint_name?: string | null;

  /** Is document approved */
  is_approved?: boolean;

  /** Is this a document (vs receipt/invoice) */
  is_document?: boolean | null;

  /** Is this a duplicate */
  is_duplicate?: boolean | null;

  /** ID of duplicate document if applicable */
  duplicate_of?: number | null;

  /** Accounting entry type */
  accounting_entry_type?: string | null;

  /** Exchange rate used */
  exch_rate?: number | null;

  /** Warnings during processing */
  warnings?: string[];

  /** Language detected in document */
  language?: string[];

  /** Additional fields not explicitly typed */
  [key: string]: any;
}

/**
 * Veryfi API error response structure
 */
export interface VeryfiApiError {
  /** Error message describing the issue */
  error?: string;

  /** Detailed error message */
  message?: string;

  /** HTTP status code */
  status?: number;

  /** Additional error details */
  details?: Record<string, any>;

  /** Error code identifier */
  code?: string;
}

/**
 * Type alias for Veryfi document - same as API response
 */
export type VeryfiDocument = VeryfiApiResponse;

/**
 * Legacy interface maintained for backward compatibility
 * @deprecated Use VeryfiApiResponse instead
 */
export interface VeryfiResponse {
  /** Veryfi document ID */
  id?: number;

  /** Processing status */
  status?: string;

  /** Vendor/provider information extracted from document */
  vendor?: {
    name?: string;
    [key: string]: any;
  };

  /** Additional fields from Veryfi response */
  [key: string]: any;
}

/**
 * Result data from Veryfi processing operation
 */
export interface VeryfiProcessData {
  /** Veryfi document ID (null if not available) */
  veryfiId: number | null;

  /** Complete Veryfi API response JSON */
  response: VeryfiResponse;

  /** S3 bucket where source document is stored */
  s3Bucket: string;

  /** S3 key of source document */
  s3Key: string;

  /** S3 URL of source document */
  s3Url: string;
}

/**
 * Result data from database storage operation
 */
export interface VeryfiStorageData {
  /** Database record ID (cuid) */
  documentId: string;

  /** Veryfi document ID */
  veryfiId: number | null;

  /** Associated Run ID (if provided) */
  runId: string | null;

  /** Storage status */
  status: 'processing' | 'completed' | 'failed';
}

/**
 * Comprehensive result from Veryfi document processing operation
 * Includes processing metadata, extracted data, and status information
 *
 * @example
 * ```typescript
 * import type { VeryfiProcessResult, StepResult } from './types.js';
 *
 * const processResult: StepResult<VeryfiProcessResult> = {
 *   success: true,
 *   data: {
 *     documentId: 'cuid_abc123',
 *     veryfiId: 12345,
 *     status: 'completed',
 *     s3Url: 'https://bucket.s3.us-east-1.amazonaws.com/uploads/file.pdf',
 *     processedAt: new Date(),
 *     runId: 'run_xyz789',
 *     extractedData: {
 *       id: 12345,
 *       status: 'processed',
 *       vendor: { name: 'Test Vendor' },
 *       total: 150.50,
 *       currency_code: 'USD'
 *     }
 *   }
 * };
 * ```
 */
export interface VeryfiProcessResult {
  /** Database record ID (cuid) */
  documentId: string;

  /** Veryfi's unique document ID */
  veryfiId: number | null;

  /** Processing status */
  status: 'processing' | 'completed' | 'failed' | 'pending';

  /** S3 URL where the source document is stored */
  s3Url: string;

  /** Timestamp when processing completed */
  processedAt: Date;

  /** Associated pipeline run ID */
  runId: string;

  /** Complete extracted data from Veryfi API */
  extractedData: VeryfiApiResponse;

  /** Error message if processing failed (optional) */
  errorMessage?: string;

  /** S3 bucket name */
  s3Bucket?: string;

  /** S3 key of source document */
  s3Key?: string;
}

/**
 * Veryfi API configuration settings
 */
export interface VeryfiConfig {
  /** Veryfi client ID for authentication */
  clientId: string;

  /** Veryfi username for authentication */
  username: string;

  /** Veryfi API key for authentication */
  apiKey: string;

  /** Optional client secret for enhanced authentication */
  clientSecret?: string;

  /** Veryfi API base URL (default: https://api.veryfi.com/api/v8/partner) */
  baseUrl?: string;

  /** Request timeout in milliseconds (default: 120000) */
  timeout?: number;
}

/**
 * Step options for Veryfi processing operations
 */
export interface VeryfiStepOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** Request timeout in milliseconds (default: 120000) */
  timeout?: number;

  /** Name of the extraction blueprint to use */
  blueprintName?: string;

  /** Maximum pages to process in the document (default: 20, max: 50) */
  maxPagesToProcess?: number;

  /** Categories to assign to the document */
  categories?: string[];

  /** Tags to associate with the document */
  tags?: string[];
}

/**
 * Extended StepContext for Veryfi processing operations
 *
 * @example
 * ```typescript
 * import type { VeryfiStepContext, StepHandler, VeryfiProcessResult, S3UploadData } from './types.js';
 *
 * interface PrevResults {
 *   s3Upload?: S3UploadData;
 * }
 *
 * const veryfiHandler: StepHandler<VeryfiStepContext<PrevResults>, VeryfiProcessResult> = async (context) => {
 *   const s3Data = context.prevResults.s3Upload;
 *   const blueprint = context.blueprintName;
 *   const tags = context.tags;
 *
 *   // Process document with Veryfi
 *   return {
 *     success: true,
 *     data: {
 *       documentId: 'doc_123',
 *       veryfiId: 12345,
 *       status: 'completed',
 *       s3Url: s3Data?.url || '',
 *       processedAt: new Date(),
 *       runId: context.runId,
 *       extractedData: { id: 12345 }
 *     }
 *   };
 * };
 * ```
 */
export interface VeryfiStepContext<TPrevResults = Record<string, unknown>>
  extends StepContext<TPrevResults> {
  /** S3 bucket containing the document */
  s3Bucket?: string;

  /** S3 key (path) to the document */
  s3Key?: string;

  /** S3 URL to the document */
  s3Url?: string;

  /** Name of the extraction blueprint to use */
  blueprintName?: string;

  /** Tags to associate with the document */
  tags?: string[];

  /** Categories to assign to the document */
  categories?: string[];

  /** Maximum pages to process in the document */
  maxPagesToProcess?: number;

  /** Veryfi configuration (overrides environment variables) */
  veryfiConfig?: VeryfiConfig;

  /** Step-specific options */
  options?: VeryfiStepOptions;
}
