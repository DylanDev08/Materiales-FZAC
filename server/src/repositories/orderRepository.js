import { prisma } from '../config/db.js';

export const orderRepository = {
  create(data) {
    return prisma.order.create({ data, include: { items: true, payment: true, ticket: { include: { items: true } } } });
  },
  findById(id) {
    return prisma.order.findUnique({ where: { id }, include: { items: true, payment: true, user: true, ticket: { include: { items: true } } } });
  },
  findByStripeSession(sessionId) {
    return prisma.order.findUnique({ where: { stripeCheckoutSessionId: sessionId }, include: { items: true, payment: true, ticket: { include: { items: true } } } });
  },
  listByUser(userId) {
    return prisma.order.findMany({ where: { userId }, include: { items: true, payment: true, ticket: { include: { items: true } } }, orderBy: { createdAt: 'desc' } });
  },
  listAll(params = {}) {
    return prisma.order.findMany({
      where: params.status ? { status: params.status } : {},
      include: { items: true, payment: true, ticket: { include: { items: true } } },
      orderBy: { createdAt: 'desc' }
    });
  },
  update(id, data) {
    return prisma.order.update({ where: { id }, data, include: { items: true, payment: true, ticket: { include: { items: true } } } });
  }
};
