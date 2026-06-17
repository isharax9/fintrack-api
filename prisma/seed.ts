import { PrismaClient } from '@prisma/client';
import { defaultCategories } from '../src/modules/categories/defaultCategories';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed does not populate categories globally any more as they are user-specific.');
  console.log(`${defaultCategories.length} categories will be seeded per-user upon registration, as required in MVP design.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
