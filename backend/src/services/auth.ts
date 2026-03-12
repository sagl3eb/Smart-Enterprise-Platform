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

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleName: string;
  organizationId: string;
  moduleAccess?: string[];
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
  role: { id: string; name: string };
  organization: { id: string; name: string; slug: string } | null;
  moduleAccess: string[];
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

// ─── Helper: get user module access ────────────────────────

async function getUserModuleAccess(userId: string, organizationId: string | null): Promise<string[]> {
  if (!organizationId) return [];

  // Get org-enabled modules
  const orgModules = await prisma.orgModule.findMany({
    where: { organizationId, isEnabled: true },
    select: { moduleName: true },
  });
  const orgEnabled = new Set(orgModules.map((m) => m.moduleName));

  // Get user-specific access
  const userAccess = await prisma.userModuleAccess.findMany({
    where: { userId },
    select: { moduleName: true, hasAccess: true },
  });

  if (userAccess.length === 0) {
    // No specific access set — return all org modules (for admin)
    return [...orgEnabled];
  }

  return userAccess
    .filter((ua) => ua.hasAccess && orgEnabled.has(ua.moduleName))
    .map((ua) => ua.moduleName);
}

// ─── Login ─────────────────────────────────────────────────

async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
    include: {
      role: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
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

  const moduleAccess = await getUserModuleAccess(user.id, user.organizationId);

  logger.info(`User logged in: ${user.email}`);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      role: { id: user.role.id, name: user.role.name },
      organization: user.organization,
      moduleAccess,
    },
    tokens: { accessToken, refreshToken },
  };
}

// ─── Admin: Create User ────────────────────────────────────

async function createUser(input: CreateUserInput, createdByUserId: string): Promise<AuthUser> {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  });
  if (existingUser) {
    throw new AuthError("Email already registered", 409);
  }

  const role = await prisma.role.findUnique({ where: { name: input.roleName } });
  if (!role) {
    throw new AuthError(`Role '${input.roleName}' not found`, 400);
  }

  const org = await prisma.organization.findUnique({ where: { id: input.organizationId } });
  if (!org) {
    throw new AuthError("Organization not found", 404);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      roleId: role.id,
      organizationId: org.id,
      isActive: true,
    },
    include: {
      role: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
  });

  // Set module access
  const modules = input.moduleAccess || [];
  for (const moduleName of modules) {
    await prisma.userModuleAccess.create({
      data: { userId: user.id, moduleName, hasAccess: true },
    });
  }

  logger.info(`User created by ${createdByUserId}: ${user.email}`);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    role: { id: user.role.id, name: user.role.name },
    organization: user.organization,
    moduleAccess: modules,
  };
}

// ─── Admin: List Users ─────────────────────────────────────

async function listUsers(organizationId?: string) {
  const where = organizationId ? { organizationId } : {};

  const users = await prisma.user.findMany({
    where,
    include: {
      role: { select: { id: true, name: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = [];
  for (const user of users) {
    const moduleAccess = await getUserModuleAccess(user.id, user.organizationId);
    result.push({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      role: user.role,
      organization: user.organization,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      moduleAccess,
    });
  }

  return result;
}

// ─── Admin: Update User Module Access ──────────────────────

async function updateUserModuleAccess(userId: string, modules: Array<{ moduleName: string; hasAccess: boolean }>) {
  for (const mod of modules) {
    await prisma.userModuleAccess.upsert({
      where: { userId_moduleName: { userId, moduleName: mod.moduleName } },
      update: { hasAccess: mod.hasAccess },
      create: { userId, moduleName: mod.moduleName, hasAccess: mod.hasAccess },
    });
  }
  logger.info(`Module access updated for user ${userId}`);
  return prisma.userModuleAccess.findMany({ where: { userId } });
}

// ─── Admin: Deactivate User ───────────────────────────────

async function deactivateUser(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  await prisma.refreshToken.deleteMany({ where: { userId } });
  logger.info(`User deactivated: ${userId}`);
}

async function activateUser(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
  logger.info(`User activated: ${userId}`);
}

// ─── Organization Management ───────────────────────────────

async function listOrganizations() {
  return prisma.organization.findMany({
    include: {
      modules: { select: { moduleName: true, isEnabled: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  });
}

async function createOrganization(data: { name: string; slug: string; description?: string; enabledModules?: string[] }) {
  const org = await prisma.organization.create({
    data: {
      name: data.name.trim(),
      slug: data.slug.toLowerCase().trim(),
      description: data.description?.trim(),
    },
  });

  const modules = data.enabledModules || [];
  for (const moduleName of modules) {
    await prisma.orgModule.create({
      data: { organizationId: org.id, moduleName, isEnabled: true },
    });
  }

  logger.info(`Organization created: ${org.name}`);
  return org;
}

async function updateOrgModules(organizationId: string, modules: Array<{ moduleName: string; isEnabled: boolean }>) {
  for (const mod of modules) {
    await prisma.orgModule.upsert({
      where: { organizationId_moduleName: { organizationId, moduleName: mod.moduleName } },
      update: { isEnabled: mod.isEnabled },
      create: { organizationId, moduleName: mod.moduleName, isEnabled: mod.isEnabled },
    });
  }
  return prisma.orgModule.findMany({ where: { organizationId } });
}

// ─── Refresh / Logout / Profile (unchanged logic) ─────────

async function refreshTokens(oldRefreshToken: string): Promise<AuthTokens> {
  let decoded;
  try {
    decoded = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new AuthError("Invalid or expired refresh token", 401);
  }

  const storedToken = await prisma.refreshToken.findUnique({ where: { token: oldRefreshToken } });
  if (!storedToken) {
    await prisma.refreshToken.deleteMany({ where: { userId: decoded.userId } });
    throw new AuthError("Refresh token has been revoked. Please login again.", 401);
  }

  if (storedToken.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    throw new AuthError("Refresh token has expired", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId }, include: { role: true } });
  if (!user || !user.isActive) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    throw new AuthError("User not found or inactive", 401);
  }

  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  const tokenPayload: TokenPayload = {
    userId: user.id, email: user.email, roleId: user.role.id, roleName: user.role.name,
  };

  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);

  await prisma.refreshToken.create({
    data: { userId: user.id, token: newRefreshToken, expiresAt: getTokenExpiryDate(REFRESH_EXPIRY) },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

async function logout(refreshToken: string, userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken, userId } });
}

async function logoutAll(userId: string): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({ where: { userId } });
  return result.count;
}

async function getProfile(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!user) throw new AuthError("User not found", 404);

  const moduleAccess = await getUserModuleAccess(user.id, user.organizationId);

  return {
    id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
    avatar: user.avatar, role: { id: user.role.id, name: user.role.name },
    organization: user.organization, moduleAccess,
  };
}

async function updateProfile(userId: string, data: { firstName?: string; lastName?: string; avatar?: string }): Promise<AuthUser> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.firstName && { firstName: data.firstName.trim() }),
      ...(data.lastName && { lastName: data.lastName.trim() }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
    },
  });
  return getProfile(userId);
}

async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthError("User not found", 404);

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new AuthError("Current password is incorrect", 400);

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
  await prisma.refreshToken.deleteMany({ where: { userId } });
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
  login, createUser, listUsers, updateUserModuleAccess,
  deactivateUser, activateUser,
  listOrganizations, createOrganization, updateOrgModules,
  refreshTokens, logout, logoutAll,
  getProfile, updateProfile, changePassword,
};

export default authService;
