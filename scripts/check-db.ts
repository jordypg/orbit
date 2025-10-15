#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Checking database...\n');

  const pipelines = await prisma.pipeline.findMany({
    include: {
      _count: {
        select: { runs: true },
      },
    },
  });

  console.log(`Found ${pipelines.length} pipelines:\n`);

  pipelines.forEach((pipeline) => {
    console.log(`ID: ${pipeline.id}`);
    console.log(`Name: ${pipeline.name}`);
    console.log(`Description: ${pipeline.description || '(none)'}`);
    console.log(`Runs: ${pipeline._count.runs}`);
    console.log(`Created: ${pipeline.createdAt}`);
    console.log('---');
  });

  await prisma.$disconnect();
}

main().catch(console.error);
