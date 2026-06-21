import { Router } from 'express';

import { healthRoutes } from './healthRoutes.js';
import { authRoutes } from './authRoutes.js';
import { productRoutes } from './productRoutes.js';
import { categoryRoutes } from './categoryRoutes.js';
import { cartRoutes } from './cartRoutes.js';
import { orderRoutes } from './orderRoutes.js';
import { checkoutRoutes } from './checkoutRoutes.js';
import { notificationRoutes } from './notificationRoutes.js';
import { auditRoutes } from './auditRoutes.js';
import { paymentRoutes } from './paymentRoutes.js';
import { adminRoutes } from './adminRoutes.js';
import { accountRoutes } from './accountRoutes.js';
import { assistantRoutes } from './assistantRoutes.js';

export const apiRoutes = Router();

apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/products', productRoutes);
apiRoutes.use('/categories', categoryRoutes);
apiRoutes.use('/cart', cartRoutes);
apiRoutes.use('/orders', orderRoutes);
apiRoutes.use('/checkout', checkoutRoutes);
apiRoutes.use('/payments', paymentRoutes);
apiRoutes.use('/notifications', notificationRoutes);
apiRoutes.use('/account', accountRoutes);
apiRoutes.use('/assistant', assistantRoutes);

apiRoutes.use('/admin/audit', auditRoutes);
apiRoutes.use('/admin', adminRoutes);

apiRoutes.use('/v1/health', healthRoutes);
apiRoutes.use('/v1/auth', authRoutes);
apiRoutes.use('/v1/products', productRoutes);
apiRoutes.use('/v1/categories', categoryRoutes);
apiRoutes.use('/v1/cart', cartRoutes);
apiRoutes.use('/v1/orders', orderRoutes);
apiRoutes.use('/v1/checkout', checkoutRoutes);
apiRoutes.use('/v1/payments', paymentRoutes);
apiRoutes.use('/v1/notifications', notificationRoutes);
apiRoutes.use('/v1/account', accountRoutes);
apiRoutes.use('/v1/assistant', assistantRoutes);
apiRoutes.use('/v1/admin/audit', auditRoutes);
apiRoutes.use('/v1/admin', adminRoutes);
