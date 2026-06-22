import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/db.js';

const server = app.listen(env.PORT, () => {
  console.log(`Materiales FZAC API escuchando en puerto ${env.PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${env.PORT} ya esta en uso.`);
    console.error(`Cierra el proceso que lo ocupa o inicia este servidor con otro PORT, por ejemplo: $env:PORT=4001; npm run dev`);
    process.exit(1);
  }

  throw error;
});

const shutdown = async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
