import { prisma } from '../config/db.js';

export const categoryRepository = {
  list() {
    return prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } }
    });
  },
  findById(id) {
    return prisma.category.findUnique({ where: { id } });
  },
  create(data) {
    return prisma.category.create({ data });
  },
  update(id, data) {
    return prisma.category.update({ where: { id }, data });
  },
  delete(id) {
    return prisma.category.delete({ where: { id } });
  }
};
