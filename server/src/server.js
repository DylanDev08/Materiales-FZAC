import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/db.js';

const server = app.listen(env.PORT, () => {
  console.log(`Materiales FZAC API escuchando en puerto ${env.PORT}`);
});

const shutdown = async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
