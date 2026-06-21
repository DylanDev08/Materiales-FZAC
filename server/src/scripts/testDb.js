import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg;

const prisma = new PrismaClient();

const main = async () => {
  const users = await prisma.user.count();
  const categories = await prisma.category.count();
  const products = await prisma.product.count();
  const orders = await prisma.order.count();

  console.log({
    users,
    categories,
    products,
    orders
  });
};

main()
  .catch((error) => {
    console.error('Error probando la base de datos');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });