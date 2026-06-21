import { env } from './env.js';

const localOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
];

const productionOrigins = [
  'https://materiales-fzac.vercel.app',
  'https://materialesfzac.com',
  'https://www.materialesfzac.com'
];

export const allowedOrigins = [
  ...localOrigins,
  ...productionOrigins,
  env.CLIENT_URL
].filter(Boolean);

export const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
};
