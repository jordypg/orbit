#!/usr/bin/env node

/**
 * Delete Non-Demo Pipelines
 *
 * Removes pipelines that are not part of the official Demo Pipeline Suite
 * from the database.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The 7 official demo pipelines to KEEP
const DEMO_PIPELINES = [
  'async-timing-demo',
  'retry-logic-demo',
  'error-recovery-demo',
  'connection-pool-demo',
  'data-transformation-demo',
  'multi-service-integration-demo',
  'document-processing',
];

async function deleteNonDemoPipelines() {
  console.log('\n🗑️  Deleting Non-Demo Pipelines\n');
  console.log('═'.repeat(60));

  try {
    // First, list all pipelines
    const allPipelines = await prisma.pipeline.findMany({
      select: { id: true, name: true }
    });

    console.log(`\nFound ${allPipelines.length} total pipeline(s) in database:`);
    allPipelines.forEach(p => {
      const isDemo = DEMO_PIPELINES.includes(p.name);
      const icon = isDemo ? '✅' : '❌';
      console.log(`  ${icon} ${p.name}`);
    });

    // Find pipelines to delete (anything NOT in the demo list)
    const pipelinesToDelete = allPipelines.filter(p =>
      !DEMO_PIPELINES.includes(p.name)
    );

    if (pipelinesToDelete.length === 0) {
      console.log('\n✅ No non-demo pipelines found to delete.\n');
      return;
    }

    console.log(`\n🗑️  Deleting ${pipelinesToDelete.length} non-demo pipeline(s)...`);
    console.log('─'.repeat(60));

    for (const pipeline of pipelinesToDelete) {
      console.log(`\n  Deleting: ${pipeline.name}`);

      // Delete associated runs first (cascade delete)
      const runCount = await prisma.run.count({
        where: { pipelineId: pipeline.id }
      });

      if (runCount > 0) {
        console.log(`    - Deleting ${runCount} associated run(s)...`);
        await prisma.run.deleteMany({
          where: { pipelineId: pipeline.id }
        });
      }

      // Delete the pipeline
      await prisma.pipeline.delete({
        where: { id: pipeline.id }
      });

      console.log(`    ✅ Deleted: ${pipeline.name}`);
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Successfully deleted all non-demo pipelines!');
    console.log('═'.repeat(60));

    // List remaining pipelines
    const remainingPipelines = await prisma.pipeline.findMany({
      select: { name: true }
    });

    console.log(`\n📋 Remaining pipelines (${remainingPipelines.length}):`);
    remainingPipelines.forEach(p => {
      console.log(`  ✅ ${p.name}`);
    });
    console.log('');

  } catch (error) {
    console.error('\n❌ Error deleting pipelines:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the deletion
deleteNonDemoPipelines();
