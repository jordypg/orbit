/**
 * Veryfi Test Helper
 * Utilities for managing Veryfi documents in integration tests
 */

import { getVeryfiTestConfig } from './test-env-setup.js';
import type { VeryfiResponse } from '../../src/services/veryfi-processor.js';

/**
 * Veryfi Test Helper Class
 * Manages test document cleanup and validation in Veryfi
 */
export class VeryfiTestHelper {
  private config: ReturnType<typeof getVeryfiTestConfig>;
  private processedDocuments: Set<number>;

  constructor() {
    this.config = getVeryfiTestConfig();
    this.processedDocuments = new Set();
  }

  /**
   * Track a processed document for cleanup
   *
   * @param documentId - Veryfi document ID
   */
  trackDocument(documentId: number): void {
    this.processedDocuments.add(documentId);
  }

  /**
   * Delete a specific document from Veryfi
   *
   * @param documentId - Veryfi document ID to delete
   */
  async deleteDocument(documentId: number): Promise<void> {
    const url = `${this.config.baseUrl}/documents/${documentId}/`;

    const headers: Record<string, string> = {
      'CLIENT-ID': this.config.clientId,
      'AUTHORIZATION': `apikey ${this.config.username}:${this.config.apiKey}`,
    };

    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok && response.status !== 404) {
      // 404 is acceptable - document may already be deleted
      const text = await response.text();
      console.warn(
        `Failed to delete Veryfi document ${documentId}: ${response.status} ${text}`
      );
    }

    this.processedDocuments.delete(documentId);
  }

  /**
   * Clean up all tracked test documents
   *
   * This should be called in test cleanup (afterAll/afterEach)
   */
  async cleanupTestDocuments(): Promise<void> {
    const documentIds = Array.from(this.processedDocuments);

    for (const documentId of documentIds) {
      try {
        await this.deleteDocument(documentId);
      } catch (error: any) {
        console.warn(
          `Error cleaning up Veryfi document ${documentId}:`,
          error.message
        );
      }
    }

    this.processedDocuments.clear();
  }

  /**
   * Validate Veryfi response structure
   *
   * @param response - Veryfi API response
   * @throws Error if response is invalid
   */
  validateResponse(response: VeryfiResponse): void {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid Veryfi response: not an object');
    }

    // Track document for cleanup if it has an ID
    if (response.id) {
      this.trackDocument(response.id);
    }
  }

  /**
   * Wait for document processing to complete (polling)
   *
   * @param documentId - Veryfi document ID
   * @param maxWaitMs - Maximum time to wait in milliseconds
   * @param pollIntervalMs - Polling interval in milliseconds
   * @returns Final document status
   */
  async waitForProcessing(
    documentId: number,
    maxWaitMs: number = 180000, // 3 minutes
    pollIntervalMs: number = 5000 // 5 seconds
  ): Promise<VeryfiResponse> {
    const startTime = Date.now();
    const url = `${this.config.baseUrl}/documents/${documentId}/`;

    const headers: Record<string, string> = {
      'CLIENT-ID': this.config.clientId,
      'AUTHORIZATION': `apikey ${this.config.username}:${this.config.apiKey}`,
    };

    while (Date.now() - startTime < maxWaitMs) {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to get document status: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      // Veryfi documents are typically processed immediately,
      // but we check the status field if it exists
      if (data.status === 'processed' || data.status === 'reviewed' || data.id) {
        return data;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(
      `Document ${documentId} processing timed out after ${maxWaitMs}ms`
    );
  }

  /**
   * Extract key fields from Veryfi response for validation
   *
   * @param response - Veryfi API response
   * @returns Object with extracted fields
   */
  extractKeyFields(response: VeryfiResponse): {
    id: number | null;
    status: string | null;
    vendorName: string | null;
    total: number | null;
    date: string | null;
    lineItemCount: number;
  } {
    return {
      id: response.id ?? null,
      status: response.status ?? null,
      vendorName: response.vendor?.name ?? null,
      total: (response as any).total ?? null,
      date: (response as any).date ?? null,
      lineItemCount: (response as any).line_items?.length ?? 0,
    };
  }
}

/**
 * Create a new Veryfi Test Helper
 *
 * @returns New VeryfiTestHelper instance
 */
export function createVeryfiTestHelper(): VeryfiTestHelper {
  return new VeryfiTestHelper();
}
