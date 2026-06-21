import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { authRateLimit, registerRateLimit } from '../middleware/rateLimitMiddleware.js';
import { authBotGuard } from '../middleware/authSecurityMiddleware.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateRequest } from '../utils/validateRequest.js';

export const authRoutes = Router();

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const serializeUser = (user) => {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl || null,
    authProvider: user.authProvider || 'LOCAL',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

const createAccessToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );

const createRefreshToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

const persistSession = async (user, res) => {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken, lastLoginAt: new Date() }
  });

  res.cookie('fzac_refresh_token', refreshToken, refreshCookieOptions);

  return {
    user: serializeUser(updatedUser),
    accessToken,
    refreshToken
  };
};

const registerValidation = validateRequest([
  { field: 'name', label: 'Nombre', required: true, type: 'string', minLength: 2, maxLength: 80 },
  { field: 'email', label: 'Email', required: true, type: 'string', email: true, maxLength: 120 },
  { field: 'password', label: 'Contraseña', required: true, type: 'string', minLength: 8, maxLength: 120 },
  { field: 'phone', label: 'Teléfono', type: 'string', maxLength: 40 }
]);

const loginValidation = validateRequest([
  { field: 'email', label: 'Email', required: true, type: 'string', email: true, maxLength: 120 },
  { field: 'password', label: 'Contraseña', required: true, type: 'string', minLength: 8, maxLength: 120 }
]);

const verifySupabaseAccessToken = async (accessToken) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    const error = new Error('Supabase Auth no está configurado en el backend');
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.SUPABASE_ANON_KEY
    }
  });

  if (!response.ok) {
    const error = new Error('No pudimos validar la sesión de Google');
    error.status = 401;
    throw error;
  }

  return response.json();
};

authRoutes.post(
  '/register',
  registerRateLimit,
  authBotGuard,
  registerValidation,
  asyncRoute(async (req, res) => {
    const { name, email, phone, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Ya existe una cuenta con ese email' });
    }

    const encryptedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        password: encryptedPassword,
        role: 'USER',
        authProvider: 'LOCAL',
        preferences: { create: {} }
      }
    });

    const session = await persistSession(user, res);
    res.status(201).json({ success: true, data: session });
  })
);

authRoutes.post(
  '/login',
  authRateLimit,
  authBotGuard,
  loginValidation,
  asyncRoute(async (req, res) => {
    const normalizedEmail = req.body.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user?.password) {
      return res.status(401).json({
        success: false,
        message: user?.authProvider === 'GOOGLE'
          ? 'Esta cuenta usa acceso con Google'
          : 'Credenciales inválidas'
      });
    }

    const isPasswordValid = await bcrypt.compare(req.body.password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const session = await persistSession(user, res);
    res.json({ success: true, data: session });
  })
);

authRoutes.post(
  '/oauth/supabase',
  authRateLimit,
  validateRequest([
    { field: 'accessToken', label: 'Token de Supabase', required: true, type: 'string', minLength: 20, maxLength: 5000 }
  ]),
  asyncRoute(async (req, res) => {
    const googleUser = await verifySupabaseAccessToken(req.body.accessToken);
    const normalizedEmail = String(googleUser.email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: 'Google no devolvió un email válido' });
    }

    const displayName =
      String(googleUser.user_metadata?.full_name || googleUser.user_metadata?.name || '').trim() ||
      normalizedEmail.split('@')[0];

    const avatarUrl =
      googleUser.user_metadata?.avatar_url || googleUser.user_metadata?.picture || null;

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ supabaseId: googleUser.id }, { email: normalizedEmail }]
      }
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          supabaseId: googleUser.id,
          authProvider: 'GOOGLE',
          avatarUrl,
          name: user.name || displayName
        }
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: displayName,
          email: normalizedEmail,
          password: null,
          phone: null,
          role: 'USER',
          authProvider: 'GOOGLE',
          supabaseId: googleUser.id,
          avatarUrl,
          preferences: { create: {} }
        }
      });
    }

    const session = await persistSession(user, res);
    res.json({ success: true, data: session });
  })
);

authRoutes.post(
  '/refresh',
  authRateLimit,
  asyncRoute(async (req, res) => {
    const refreshToken = req.cookies?.fzac_refresh_token || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token requerido' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Refresh token inválido' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ success: false, message: 'Sesión inválida' });
    }

    const session = await persistSession(user, res);
    res.json({ success: true, data: session });
  })
);

authRoutes.get(
  '/me',
  protect,
  asyncRoute(async (req, res) => {
    res.json({ success: true, data: { user: serializeUser(req.user) } });
  })
);

authRoutes.post(
  '/logout',
  protect,
  asyncRoute(async (req, res) => {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshToken: null }
    });

    res.clearCookie('fzac_refresh_token', refreshCookieOptions);
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
  })
);

export default authRoutes;
