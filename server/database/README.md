# SQL y Prisma

- `schema.sql`: concatenación ordenada de las migraciones, útil para inspección o una base PostgreSQL vacía.
- `../src/prisma/schema.prisma`: fuente de verdad del modelo.
- `../src/prisma/migrations/`: historial de cambios.
- `../src/prisma/seed.js`: datos iniciales, usuarios de prueba, catálogo, pedidos, eventos y conversaciones.

Comandos recomendados desde la raíz:

```bash
npm run prisma:generate
npm run db:migrate
npm run db:seed
```
