import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '../..');
const projectRoot = path.resolve(serverRoot, '..');

dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(serverRoot, '.env'), override: true });
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const fallbackDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/materiales_fzac?schema=public';

const clean = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim().replace(/^['"]|['"]$/g, '');
};

const get = (key, fallback = '') => {
  const value = clean(process.env[key]);
  return value || fallback;
};

const getNumber = (key, fallback) => {
  const value = Number(get(key));
  return Number.isFinite(value) ? value : fallback;
};

const isProbablyPostgresUrl = (value) => /^postgres(ql)?:\/\//i.test(String(value || ''));

const getDatabaseUrl = () => {
  const value = get('DATABASE_URL');

  if (value && isProbablyPostgresUrl(value)) return value;

  if (isProduction) {
    throw new Error('DATABASE_URL debe ser una URL PostgreSQL válida');
  }

  if (value) {
    console.warn('[env] DATABASE_URL inválida. Usando URL local de desarrollo.');
  }

  return fallbackDatabaseUrl;
};

const databaseUrl = getDatabaseUrl();
const directUrl = get('DIRECT_URL', databaseUrl);

if (directUrl && !isProbablyPostgresUrl(directUrl)) {
  if (isProduction) {
    throw new Error('DIRECT_URL debe ser una URL PostgreSQL válida');
  }

  console.warn('[env] DIRECT_URL inválida. Se usará DATABASE_URL como fallback.');
}

const safeDirectUrl = isProbablyPostgresUrl(directUrl) ? directUrl : databaseUrl;

const getUrl = (key, fallback) => {
  const value = get(key, fallback);

  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return value;
  } catch {
    if (isProduction) {
      throw new Error(`${key} debe ser una URL válida`);
    }

    console.warn(`[env] ${key} inválida. Usando valor local: ${fallback}`);
    return fallback;
  }
};

const getSecret = (key, fallback) => {
  const value = get(key, fallback);

  if (isProduction && value.length < 24) {
    throw new Error(`${key} debe tener al menos 24 caracteres en producción`);
  }

  return value.length >= 24 ? value : fallback;
};

if (isProduction) {
  const missing = ['DATABASE_URL', 'DIRECT_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].filter(
    (key) => !clean(process.env[key])
  );

  if (missing.length) {
    throw new Error(`Faltan variables requeridas en producción: ${missing.join(', ')}`);
  }
}

export const env = {
  NODE_ENV: get('NODE_ENV', 'development'),
  PORT: getNumber('PORT', 4000),
  CLIENT_URL: getUrl('CLIENT_URL', 'http://localhost:5173'),
  API_URL: getUrl('API_URL', 'http://localhost:4000'),
  DATABASE_URL: databaseUrl,
  DIRECT_URL: safeDirectUrl,
  JWT_ACCESS_SECRET: getSecret('JWT_ACCESS_SECRET', 'dev_access_secret_materiales_fzac_2026'),
  JWT_REFRESH_SECRET: getSecret('JWT_REFRESH_SECRET', 'dev_refresh_secret_materiales_fzac_2026'),
  JWT_ACCESS_EXPIRES_IN: get('JWT_ACCESS_EXPIRES_IN', '15m'),
  JWT_REFRESH_EXPIRES_IN: get('JWT_REFRESH_EXPIRES_IN', '7d'),
  STRIPE_SECRET_KEY: get('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: get('STRIPE_WEBHOOK_SECRET'),
  STRIPE_CURRENCY: get('STRIPE_CURRENCY', 'ars'),
  CLOUDINARY_CLOUD_NAME: get('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: get('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: get('CLOUDINARY_API_SECRET'),
  SMTP_HOST: get('SMTP_HOST', 'smtp.gmail.com'),
  SMTP_PORT: getNumber('SMTP_PORT', 587),
  SMTP_USER: get('SMTP_USER'),
  SMTP_PASS: get('SMTP_PASS'),
  SMTP_FROM: get('SMTP_FROM', 'Materiales FZAC <ventas@materialesfzac.com>'),
  MERCADOPAGO_ACCESS_TOKEN: get('MERCADOPAGO_ACCESS_TOKEN'),
  MERCADOPAGO_PUBLIC_KEY: get('MERCADOPAGO_PUBLIC_KEY'),
  MERCADOPAGO_WEBHOOK_SECRET: get('MERCADOPAGO_WEBHOOK_SECRET'),
  SUPABASE_URL: get('SUPABASE_URL'),
  SUPABASE_ANON_KEY: get('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: get('SUPABASE_SERVICE_ROLE_KEY'),
  OPENAI_API_KEY: get('OPENAI_API_KEY'),
  OPENAI_MODEL: get('OPENAI_MODEL', 'gpt-4.1-mini'),
  ASSISTANT_ENABLED: get('ASSISTANT_ENABLED', 'true') !== 'false'
};

process.env.NODE_ENV = env.NODE_ENV;
process.env.DATABASE_URL = env.DATABASE_URL;
process.env.DIRECT_URL = env.DIRECT_URL;
process.env.JWT_ACCESS_SECRET = env.JWT_ACCESS_SECRET;
process.env.JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;
process.env.JWT_ACCESS_EXPIRES_IN = env.JWT_ACCESS_EXPIRES_IN;
process.env.JWT_REFRESH_EXPIRES_IN = env.JWT_REFRESH_EXPIRES_IN;

export const paymentsMode = env.STRIPE_SECRET_KEY ? 'stripe' : 'mock';
