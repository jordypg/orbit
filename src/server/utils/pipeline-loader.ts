/**
 * Server Pipeline Loader
 * Ensures pipelines are loaded into the registry for API access
 */

import { registry } from '../../core/index.js';

// Import all pipelines explicitly
// This is more reliable than dynamic discovery in Next.js
import documentProcessing from '../../pipelines/document-processing.js';
import asyncTimingDemo from '../../pipelines/async-timing-demo.js';
import connectionPoolDemo from '../../pipelines/connection-pool-demo.js';
import dataTransformationDemo from '../../pipelines/data-transformation-demo.js';
import errorRecoveryDemo from '../../pipelines/error-recovery-demo.js';
import multiServiceIntegrationDemo from '../../pipelines/multi-service-integration-demo.js';
import retryLogicDemo from '../../pipelines/retry-logic-demo.js';

let pipelinesLoaded = false;

const PIPELINES = [
  documentProcessing,
  asyncTimingDemo,
  connectionPoolDemo,
  dataTransformationDemo,
  errorRecoveryDemo,
  multiServiceIntegrationDemo,
  retryLogicDemo,
];

/**
 * Loads all pipelines into the registry
 * Only loads once per process lifecycle
 */
export async function ensurePipelinesLoaded(): Promise<void> {
  if (pipelinesLoaded) {
    return;
  }

  try {
    for (const pipeline of PIPELINES) {
      if (pipeline && pipeline.name && pipeline.steps) {
        // Only register if not already registered
        if (!registry.hasPipeline(pipeline.name)) {
          registry.registerPipeline(pipeline);
          console.log(`✓ Loaded pipeline: ${pipeline.name} (${pipeline.steps.length} steps)`);
        }
      }
    }

    pipelinesLoaded = true;
    console.log(`✅ Loaded ${registry.count()} pipelines into registry`);
  } catch (error) {
    console.error('Failed to load pipelines:', error);
    // Don't throw - allow the app to continue even if pipeline loading fails
  }
}
