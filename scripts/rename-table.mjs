/**
 * Script to rename veryfi_documents table to medical_documents
 * This preserves all existing data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Renaming table veryfi_documents to medical_documents...');

    // Check if old table exists
    const tableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'veryfi_documents'
      ) as exists;
    `;

    if (tableCheck[0]?.exists) {
      // Rename the table
      await prisma.$executeRaw`ALTER TABLE veryfi_documents RENAME TO medical_documents;`;
      console.log('✅ Table renamed successfully');
    } else {
      console.log('ℹ️  Table veryfi_documents does not exist, skipping rename');
    }

  } catch (error) {
    console.error('❌ Error renaming table:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
