import { asyncHandler } from '../utils/asyncHandler.js';
import { authService } from '../services/authService.js';
import { publicUser } from '../utils/format.js';

export const authController = {
  register: asyncHandler(async (req, res) => {
    const session = await authService.register(req.body);
    res.status(201).json({ success: true, data: session });
  }),

  login: asyncHandler(async (req, res) => {
    const session = await authService.login(req.body);
    res.json({ success: true, data: session });
  }),

  refresh: asyncHandler(async (req, res) => {
    const session = await authService.refresh(req.body.refreshToken);
    res.json({ success: true, data: session });
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.user.id);
    res.json({ success: true, message: 'Sesión cerrada' });
  }),

  me: asyncHandler(async (req, res) => {
    res.json({ success: true, data: publicUser(req.user) });
  })
};
