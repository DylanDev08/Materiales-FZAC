import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { corsOptions } from './config/cors.js';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/security.js';
import { apiRoutes } from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import {
  requestId,
  sanitizeBody,
  securityHeaders
} from './middleware/securityMiddleware.js';

export const app = express();

if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(requestId);
app.use(securityHeaders);

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(cors(corsOptions));
app.use(cookieParser());

app.use('/api/checkout/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(sanitizeBody);

app.use('/api', apiLimiter, apiRoutes);

app.use(notFound);
app.use(errorHandler);