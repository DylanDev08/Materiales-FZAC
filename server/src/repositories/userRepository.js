import { prisma } from '../config/db.js';

export const userRepository = {
  findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },
  findById(id) {
    return prisma.user.findUnique({ where: { id } });
  },
  create(data) {
    return prisma.user.create({ data });
  },
  update(id, data) {
    return prisma.user.update({ where: { id }, data });
  }
};
