import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';

const getTokenFromRequest = (req) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return header.replace('Bearer ', '').trim();
};

const resolveUserFromToken = async (token) => {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

  return prisma.user.findUnique({
    where: { id: decoded.id }
  });
};

export const protect = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado'
    });
  }

  try {
    const user = await resolveUserFromToken(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Sesión inválida'
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Sesión expirada o inválida'
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = await resolveUserFromToken(token);
  } catch {
    req.user = null;
  }

  next();
};

export const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'No tenés permisos para acceder a esta sección'
    });
  }

  next();
};

export const operatorOrAdmin = (req, res, next) => {
  const allowedRoles = ['ADMIN', 'OPERATOR'];

  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'No tenés permisos para realizar esta acción'
    });
  }

  next();
};
