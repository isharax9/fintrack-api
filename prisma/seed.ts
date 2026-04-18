import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultCategories = [
  { name: "Food & Dining",   color: "#FF6B6B", icon: "utensils"     },
  { name: "Transport",       color: "#4ECDC4", icon: "car"          },
  { name: "Housing",         color: "#45B7D1", icon: "home"         },
  { name: "Entertainment",   color: "#96CEB4", icon: "film"         },
  { name: "Shopping",        color: "#FFEAA7", icon: "shopping-bag" },
  { name: "Health",          color: "#DDA0DD", icon: "heart"        },
  { name: "Education",       color: "#98D8C8", icon: "book"         },
  { name: "Savings",         color: "#7EC8E3", icon: "piggy-bank"   },
  { name: "Income",          color: "#90EE90", icon: "trending-up"  },
  { name: "Other",           color: "#D3D3D3", icon: "more-horizontal" }
];

async function main() {
  console.log('Seed does not populate categories globally any more as they are user-specific.');
  console.log('Categories will be seeded per-user upon registration, as required in MVP design.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
