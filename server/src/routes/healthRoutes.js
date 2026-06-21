import { Router } from 'express';
import { healthController } from '../controllers/healthController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const healthRoutes = Router();

healthRoutes.get('/', asyncHandler(healthController.api));
healthRoutes.get('/db', asyncHandler(healthController.database));
healthRoutes.get('/env', asyncHandler(healthController.environment));
