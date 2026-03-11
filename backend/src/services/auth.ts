import prisma from "../prisma/client";
import bcrypt from "bcrypt";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getTokenExpiryDate,
  TokenPayload,
} from "../utils/jwt";
import logger from "../utils/logger";

const SALT_ROUNDS = 12;
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d";

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  role: {
    id: string;
    name: string;
  };
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

async function register(input: RegisterInput): Promise<AuthResult> {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  });

  if (existingUser) {
    throw new AuthError("Email already registered", 409);
  }

  const roleName = input.roleName || "employee";
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new AuthError(`Role '${roleName}' not found`, 400);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      roleId: role.id,
      isActive: true,
    },
    include: {
      role: true,
    },
  });

  const tokenPayload: TokenPayload = {
    userId: user.id,
    email: user.email,
    roleId: user.role.id,
    roleName: user.role.name,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: getTokenExpiryDate(REFRESH_EXPIRY),
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  logger.info(`User registered: ${user.email}`);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      role: {
        id: user.role.id,
        name: user.role.name,
      },
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
    include: { role: true },
  });

  if (!user) {
    throw new AuthError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw new AuthError("Account is deactivated. Contact administrator.", 403);
  }

  const passwordValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordValid) {
    throw new AuthError("Invalid email or password", 401);
  }

  const tokenPayload: TokenPayload = {
    userId: user.id,
    email: user.email,
    roleId: user.role.id,
    roleName: user.role.name,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: getTokenExpiryDate(REFRESH_EXPIRY),
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  logger.info(`User logged in: ${user.email}`);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      role: {
        id: user.role.id,
        name: user.role.name,
      },
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

async function refreshTokens(oldRefreshToken: string): Promise<AuthTokens> {
  let decoded;
  try {
    decoded = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new AuthError("Invalid or expired refresh token", 401);
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: oldRefreshToken },
  });

  if (!storedToken) {
    logger.warn(`Refresh token reuse attempt for user ${decoded.userId}`);
    await prisma.refreshToken.deleteMany({
      where: { userId: decoded.userId },
    });
    throw new AuthError("Refresh token has been revoked. Please login again.", 401);
  }

  if (storedToken.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    throw new AuthError("Refresh token has expired", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    throw new AuthError("User not found or inactive", 401);
  }

  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  const tokenPayload: TokenPayload = {
    userId: user.id,
    email: user.email,
    roleId: user.role.id,
    roleName: user.role.name,
  };

  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: newRefreshToken,
      expiresAt: getTokenExpiryDate(REFRESH_EXPIRY),
    },
  });

  logger.info(`Tokens refreshed for user: ${user.email}`);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

async function logout(refreshToken: string, userId: string): Promise<void> {
  const deleted = await prisma.refreshToken.deleteMany({
    where: {
      token: refreshToken,
      userId,
    },
  });

  if (deleted.count === 0) {
    logger.warn(`Logout attempted with invalid token for user ${userId}`);
  } else {
    logger.info(`User logged out: ${userId}`);
  }
}

async function logoutAll(userId: string): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: { userId },
  });

  logger.info(`All sessions revoked for user ${userId} (${result.count} tokens)`);
  return result.count;
}

async function getProfile(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user) {
    throw new AuthError("User not found", 404);
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    role: {
      id: user.role.id,
      name: user.role.name,
    },
  };
}

async function updateProfile(
  userId: string,
  data: { firstName?: string; lastName?: string; avatar?: string }
): Promise<AuthUser> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.firstName && { firstName: data.firstName.trim() }),
      ...(data.lastName && { lastName: data.lastName.trim() }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
    },
    include: { role: true },
  });

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    role: {
      id: user.role.id,
      name: user.role.name,
    },
  };
}

async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new AuthError("User not found", 404);
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AuthError("Current password is incorrect", 400);
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  await prisma.refreshToken.deleteMany({ where: { userId } });

  logger.info(`Password changed for user: ${user.email}`);
}

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

const authService = {
  register,
  login,
  refreshTokens,
  logout,
  logoutAll,
  getProfile,
  updateProfile,
  changePassword,
};

export default authService;
