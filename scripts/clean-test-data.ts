#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning test data...\n');

  // Delete test pipelines (those with timestamps in names or no description)
  const result = await prisma.pipeline.deleteMany({
    where: {
      OR: [
        { name: { contains: '-1760' } }, // Timestamp-based test names
        {
          AND: [
            { description: null },
            { name: { startsWith: 'test-' } },
          ],
        },
        { name: { startsWith: 'success-pipeline-' } },
        { name: { startsWith: 'failing-pipeline-' } },
        { name: { startsWith: 'throwing-pipeline-' } },
        { name: { startsWith: 'metadata-pipeline-' } },
        { name: { startsWith: 'reusable-' } },
        { name: { startsWith: 'multi-step-' } },
        { name: { startsWith: 'retry-success-' } },
        { name: { startsWith: 'always-fail-' } },
        { name: { startsWith: 'throwing-' } },
        { name: { startsWith: 'custom-retry-' } },
        { name: { startsWith: 'multi-retry-' } },
        { name: { startsWith: 'status-transitions-' } },
        { name: { startsWith: 'stop-on-fail-' } },
      ],
    },
  });

  console.log(`✓ Deleted ${result.count} test pipelines\n`);

  // Show remaining pipelines
  const remaining = await prisma.pipeline.findMany({
    include: {
      _count: {
        select: { runs: true },
      },
    },
  });

  console.log(`Remaining ${remaining.length} pipelines:\n`);

  remaining.forEach((pipeline) => {
    console.log(`- ${pipeline.name}`);
    console.log(`  Description: ${pipeline.description || '(none)'}`);
    console.log(`  Runs: ${pipeline._count.runs}`);
    console.log('');
  });

  await prisma.$disconnect();
}

main().catch(console.error);
