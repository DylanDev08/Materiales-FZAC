import './env.js';
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg;

const globalForPrisma = globalThis;

const prismaLog = process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'];

const createPrismaClient = () => {
  try {
    return new PrismaClient({
      log: prismaLog
    });
  } catch (error) {
    console.error('No se pudo inicializar Prisma Client.');
    console.error('Verificá que exista server/.env con DATABASE_URL y que hayas ejecutado npm install.');
    console.error(error?.message || error);
    throw error;
  }
};

export const prisma = globalForPrisma.__fzacPrisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__fzacPrisma = prisma;
}

export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    console.log('Base de datos conectada correctamente');
  } catch (error) {
    console.error('No se pudo conectar con la base de datos.');
    console.error('Revisá DATABASE_URL/DIRECT_URL en server/.env y confirmá que Supabase esté disponible.');
    console.error(error?.message || error);
    throw error;
  }
};

export const disconnectDatabase = async () => {
  await prisma.$disconnect();
};
