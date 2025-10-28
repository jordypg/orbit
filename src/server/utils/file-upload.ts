import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { existsSync } from "fs";

/**
 * Allowed MIME types for document uploads
 */
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
] as const;

/**
 * File extension mapping for MIME types
 */
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

/**
 * Temp directory for uploaded files
 */
const TEMP_UPLOAD_DIR = process.env.TEMP_UPLOAD_DIR || "/tmp/orbit-uploads";

/**
 * Validates if a MIME type is allowed for document processing
 */
export function isAllowedFileType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(
    mimeType as (typeof ALLOWED_MIME_TYPES)[number]
  );
}

/**
 * Gets file extension for a MIME type
 */
export function getExtensionForMimeType(mimeType: string): string {
  return MIME_TO_EXT[mimeType] || ".bin";
}

/**
 * Ensures temp upload directory exists
 */
export async function ensureTempDirectory(): Promise<void> {
  if (!existsSync(TEMP_UPLOAD_DIR)) {
    await mkdir(TEMP_UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Saves uploaded file to temp storage
 * @returns Absolute path to saved file
 */
export async function saveUploadedFile(
  buffer: Buffer,
  mimeType: string
): Promise<{ tempPath: string; filename: string }> {
  await ensureTempDirectory();

  const extension = getExtensionForMimeType(mimeType);
  const filename = `${randomUUID()}${extension}`;
  const tempPath = join(TEMP_UPLOAD_DIR, filename);

  await writeFile(tempPath, buffer);

  return { tempPath, filename };
}

/**
 * Validates and saves uploaded file
 * @throws Error if file type is not allowed
 */
export async function processUpload(
  buffer: Buffer,
  mimeType: string,
  originalName?: string
): Promise<{ tempPath: string; filename: string; originalName?: string }> {
  if (!isAllowedFileType(mimeType)) {
    throw new Error(
      `File type ${mimeType} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`
    );
  }

  const { tempPath, filename } = await saveUploadedFile(buffer, mimeType);

  return {
    tempPath,
    filename,
    originalName,
  };
}
