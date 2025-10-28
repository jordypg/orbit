/**
 * File Upload Integration Tests
 * Tests for the file upload utilities and API endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  isAllowedFileType,
  getExtensionForMimeType,
  processUpload,
  saveUploadedFile,
} from '../../src/server/utils/file-upload.js';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import * as path from 'path';

describe('File Upload Utilities', () => {
  const uploadedFiles: string[] = [];

  afterAll(async () => {
    // Cleanup uploaded test files
    for (const filePath of uploadedFiles) {
      try {
        if (existsSync(filePath)) {
          await unlink(filePath);
        }
      } catch (error: any) {
        console.warn(`Failed to cleanup test file ${filePath}:`, error.message);
      }
    }
  });

  describe('isAllowedFileType', () => {
    it('should allow image/jpeg', () => {
      expect(isAllowedFileType('image/jpeg')).toBe(true);
    });

    it('should allow image/png', () => {
      expect(isAllowedFileType('image/png')).toBe(true);
    });

    it('should allow image/gif', () => {
      expect(isAllowedFileType('image/gif')).toBe(true);
    });

    it('should allow image/webp', () => {
      expect(isAllowedFileType('image/webp')).toBe(true);
    });

    it('should allow application/pdf', () => {
      expect(isAllowedFileType('application/pdf')).toBe(true);
    });

    it('should reject text/plain', () => {
      expect(isAllowedFileType('text/plain')).toBe(false);
    });

    it('should reject application/json', () => {
      expect(isAllowedFileType('application/json')).toBe(false);
    });

    it('should reject video/mp4', () => {
      expect(isAllowedFileType('video/mp4')).toBe(false);
    });
  });

  describe('getExtensionForMimeType', () => {
    it('should return .jpg for image/jpeg', () => {
      expect(getExtensionForMimeType('image/jpeg')).toBe('.jpg');
    });

    it('should return .png for image/png', () => {
      expect(getExtensionForMimeType('image/png')).toBe('.png');
    });

    it('should return .gif for image/gif', () => {
      expect(getExtensionForMimeType('image/gif')).toBe('.gif');
    });

    it('should return .pdf for application/pdf', () => {
      expect(getExtensionForMimeType('application/pdf')).toBe('.pdf');
    });

    it('should return .bin for unknown mime types', () => {
      expect(getExtensionForMimeType('unknown/type')).toBe('.bin');
    });
  });

  describe('saveUploadedFile', () => {
    it('should save a valid image file', async () => {
      // Create a simple test buffer (1x1 PNG)
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const result = await saveUploadedFile(pngBuffer, 'image/png');

      expect(result.tempPath).toBeDefined();
      expect(result.filename).toBeDefined();
      expect(result.filename).toMatch(/\.png$/);
      expect(existsSync(result.tempPath)).toBe(true);

      uploadedFiles.push(result.tempPath);
    });

    it('should save a PDF file', async () => {
      // Create a minimal PDF buffer
      const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');

      const result = await saveUploadedFile(pdfBuffer, 'application/pdf');

      expect(result.tempPath).toBeDefined();
      expect(result.filename).toBeDefined();
      expect(result.filename).toMatch(/\.pdf$/);
      expect(existsSync(result.tempPath)).toBe(true);

      uploadedFiles.push(result.tempPath);
    });
  });

  describe('processUpload', () => {
    it('should process and save a valid image', async () => {
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const result = await processUpload(pngBuffer, 'image/png', 'test-image.png');

      expect(result.tempPath).toBeDefined();
      expect(result.filename).toBeDefined();
      expect(result.originalName).toBe('test-image.png');
      expect(existsSync(result.tempPath)).toBe(true);

      uploadedFiles.push(result.tempPath);
    });

    it('should reject disallowed file types', async () => {
      const buffer = Buffer.from('test content');

      await expect(
        processUpload(buffer, 'text/plain', 'test.txt')
      ).rejects.toThrow('File type text/plain is not allowed');
    });

    it('should reject video files', async () => {
      const buffer = Buffer.from('fake video content');

      await expect(
        processUpload(buffer, 'video/mp4', 'test.mp4')
      ).rejects.toThrow('File type video/mp4 is not allowed');
    });

    it('should reject executable files', async () => {
      const buffer = Buffer.from('fake executable');

      await expect(
        processUpload(buffer, 'application/x-executable', 'test.exe')
      ).rejects.toThrow('File type application/x-executable is not allowed');
    });
  });

  describe('File naming', () => {
    it('should generate unique filenames for multiple uploads', async () => {
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const result1 = await saveUploadedFile(pngBuffer, 'image/png');
      const result2 = await saveUploadedFile(pngBuffer, 'image/png');

      expect(result1.filename).not.toBe(result2.filename);
      expect(result1.tempPath).not.toBe(result2.tempPath);

      uploadedFiles.push(result1.tempPath, result2.tempPath);
    });

    it('should preserve file extensions', async () => {
      const jpegBuffer = Buffer.from('fake jpeg content');
      const result = await saveUploadedFile(jpegBuffer, 'image/jpeg');

      expect(result.filename).toMatch(/\.jpg$/);
      expect(result.tempPath).toMatch(/\.jpg$/);

      uploadedFiles.push(result.tempPath);
    });
  });
});
