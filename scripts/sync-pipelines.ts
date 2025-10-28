#!/usr/bin/env node
/**
 * Sync Pipelines Script
 * Syncs pipeline definitions from code to database for UI display
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import dotenv from 'dotenv';
import prisma from '../src/core/prisma.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PipelineDefinition {
  name: string;
  description?: string;
  schedule?: string;
  steps: any[];
}

/**
 * Discover pipeline files in the pipelines directory
 */
async function discoverPipelines(): Promise<string[]> {
  const pipelinesDir = join(__dirname, '../src/pipelines');

  try {
    const files = readdirSync(pipelinesDir);
    return files.filter(
      (file) =>
        (file.endsWith('.js') || file.endsWith('.ts')) &&
        !file.endsWith('.d.ts') &&
        !file.includes('.test.') &&
        !file.includes('README')
    );
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error(`❌ Pipelines directory not found: ${pipelinesDir}`);
      return [];
    }
    throw error;
  }
}

/**
 * Load a pipeline definition from a file
 */
async function loadPipeline(filepath: string): Promise<PipelineDefinition | null> {
  try {
    const module = await import(filepath);
    const pipeline = module.default || module.pipeline;

    if (!pipeline || !pipeline.name || !pipeline.steps) {
      return null;
    }

    return pipeline;
  } catch (error: any) {
    console.error(`❌ Failed to load ${filepath}:`, error.message);
    return null;
  }
}

/**
 * Sync a pipeline to the database
 */
async function syncPipelineToDb(pipeline: PipelineDefinition): Promise<void> {
  // Check if pipeline already exists
  const existing = await prisma.pipeline.findUnique({
    where: { name: pipeline.name },
  });

  if (existing) {
    // Update existing pipeline
    await prisma.pipeline.update({
      where: { id: existing.id },
      data: {
        description: pipeline.description,
        schedule: pipeline.schedule,
      },
    });
    console.log(`   ✓ Updated: ${pipeline.name}`);
  } else {
    // Create new pipeline
    await prisma.pipeline.create({
      data: {
        name: pipeline.name,
        description: pipeline.description,
        schedule: pipeline.schedule,
      },
    });
    console.log(`   ✓ Created: ${pipeline.name}`);
  }
}

/**
 * Main sync function
 */
async function syncPipelines() {
  console.log('🔄 Syncing pipelines from code to database...\n');

  // Discover pipeline files
  const files = await discoverPipelines();

  if (files.length === 0) {
    console.log('⚠️  No pipeline files found');
    return;
  }

  console.log(`📁 Found ${files.length} pipeline file(s):\n`);

  let syncedCount = 0;
  let errorCount = 0;

  // Load and sync each pipeline
  for (const file of files) {
    // Convert .ts to .js for loading from dist
    const jsFile = file.replace(/\.ts$/, '.js');
    const filepath = join(__dirname, '../dist/pipelines', jsFile);
    console.log(`📄 Processing: ${file}`);

    const pipeline = await loadPipeline(filepath);

    if (pipeline) {
      try {
        await syncPipelineToDb(pipeline);
        syncedCount++;
      } catch (error: any) {
        console.error(`   ❌ Failed to sync: ${error.message}`);
        errorCount++;
      }
    } else {
      console.log(`   ⚠️  Skipped (invalid pipeline definition)`);
      errorCount++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Sync Summary:`);
  console.log(`   ✓ Synced: ${syncedCount}`);
  if (errorCount > 0) {
    console.log(`   ❌ Failed: ${errorCount}`);
  }
  console.log(`${'='.repeat(60)}\n`);

  if (syncedCount > 0) {
    console.log('✨ Pipelines synced successfully!');
    console.log('💡 Refresh your browser to see the new pipelines in the UI');
  }
}

// Run sync
syncPipelines()
  .catch((error) => {
    console.error('💥 Sync failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
