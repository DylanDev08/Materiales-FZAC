import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/userRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { publicUser } from '../utils/format.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens.js';

const buildSession = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await userRepository.update(user.id, { refreshToken });
  return { user: publicUser(user), accessToken, refreshToken };
};

export const authService = {
  async register({ name, email, password, phone }) {
    const normalizedEmail = email.toLowerCase();
    const exists = await userRepository.findByEmail(normalizedEmail);
    if (exists) throw new ApiError(409, 'Ya existe una cuenta con ese email');

    const hash = await bcrypt.hash(password, 12);
    const user = await userRepository.create({ name, email: normalizedEmail, phone, password: hash });
    return buildSession(user);
  },

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email.toLowerCase());
    if (!user) throw new ApiError(401, 'Credenciales inválidas');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new ApiError(401, 'Credenciales inválidas');

    return buildSession(user);
  },

  async refresh(refreshToken) {
    if (!refreshToken) throw new ApiError(401, 'Refresh token requerido');

    const payload = verifyRefreshToken(refreshToken);
    const user = await userRepository.findById(payload.sub);

    if (!user || user.refreshToken !== refreshToken) {
      throw new ApiError(401, 'Refresh token inválido');
    }

    return buildSession(user);
  },

  async logout(userId) {
    await userRepository.update(userId, { refreshToken: null });
  }
};
