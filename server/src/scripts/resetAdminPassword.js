import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg;
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const main = async () => {
  const email = 'admin@fzac.com';
  const plainPassword = 'Admin1234!';

  const encryptedPassword = await bcrypt.hash(plainPassword, 12);

  const user = await prisma.user.upsert({
    where: {
      email
    },
    update: {
      password: encryptedPassword,
      role: 'ADMIN'
    },
    create: {
      name: 'Admin FZAC',
      email,
      phone: '+54 341 0000000',
      password: encryptedPassword,
      role: 'ADMIN'
    }
  });

  console.log('Admin actualizado correctamente');
  console.log({
    id: user.id,
    email: user.email,
    role: user.role
  });
};

main()
  .catch((error) => {
    console.error('Error reseteando admin');
    console.error(error.message);
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
