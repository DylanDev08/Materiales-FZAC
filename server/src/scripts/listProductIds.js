import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg;

const prisma = new PrismaClient();

const main = async () => {
  const products = await prisma.product.findMany({
    take: 20,
    select: {
      id: true,
      name: true,
      sku: true,
      stock: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  console.table(products);
};

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });