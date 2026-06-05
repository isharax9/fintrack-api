import { listCategories } from './modules/categories/categories.service';
import { prisma } from './config/db';

async function main() {
  const userId = 'cmq1bbg58000312lt7tcw41ik';
  console.log('Calling listCategories for userId:', userId);
  try {
    const res = await listCategories(userId);
    console.log('Result length:', res.length);
  } catch (err) {
    console.error('Error in listCategories:', err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
