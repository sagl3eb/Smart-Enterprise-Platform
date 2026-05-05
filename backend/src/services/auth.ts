import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
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
  if (input.roleName === "super_admin") {
    throw new AuthError("Cannot create super_admin accounts through this endpoint", 403);
  }

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

  // Only one viewer account per organization.
  if (role.name === "viewer") {
    const existingViewer = await prisma.user.findFirst({
      where: { organizationId: org.id, role: { name: "viewer" } },
      select: { id: true },
    });
    if (existingViewer) {
      throw new AuthError("This organization already has a viewer account", 409);
    }
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const EMPLOYEE_ROLES = new Set(["employee", "manager"]);

  // Create user + (if applicable) employee atomically so a failed employee
  // provisioning never leaves a dangling user account.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
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

    const modules = input.moduleAccess || [];
    for (const moduleName of modules) {
      await tx.userModuleAccess.create({
        data: { userId: created.id, moduleName, hasAccess: true },
      });
    }

    if (EMPLOYEE_ROLES.has(role.name)) {
      let department = await tx.department.findFirst({
        where: { organizationId: org.id, isActive: true },
        orderBy: { createdAt: "asc" },
      });
      if (!department) {
        department = await tx.department.create({
          data: {
            organizationId: org.id,
            name: "General",
            code: "GEN",
            description: "Default department",
            isActive: true,
          },
        });
      }
      const prefix = "EMP-";
      const last = await tx.employee.findFirst({
        where: { organizationId: org.id, employeeCode: { startsWith: prefix } },
        orderBy: { employeeCode: "desc" },
        select: { employeeCode: true },
      });
      const lastSeq = last ? Number(last.employeeCode.slice(prefix.length)) || 0 : 0;
      const employeeCode = `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
      await tx.employee.create({
        data: {
          organizationId: org.id,
          userId: created.id,
          employeeCode,
          departmentId: department.id,
          firstName: created.firstName,
          lastName: created.lastName,
          email: created.email,
          position: role.name === "manager" ? "Manager" : "Employee",
          hireDate: new Date(),
          salary: new Prisma.Decimal(0),
          employmentType: "full_time",
          status: "active",
        },
      });
    }

    return created;
  });

  logger.info(`User created by ${createdByUserId}: ${user.email}`);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    role: { id: user.role.id, name: user.role.name },
    organization: user.organization,
    moduleAccess: input.moduleAccess || [],
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

// ─── Admin: Get User Details (full) ────────────────────────

async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      organization: { select: { id: true, name: true, slug: true } },
      employee: {
        include: { department: { select: { id: true, name: true, code: true } } },
      },
    },
  });
  if (!user) throw new AuthError("User not found", 404);

  const rawAccess = await prisma.userModuleAccess.findMany({
    where: { userId: user.id },
    select: { moduleName: true, hasAccess: true },
  });

  const orgModules = user.organizationId
    ? await prisma.orgModule.findMany({
        where: { organizationId: user.organizationId, isEnabled: true },
        select: { moduleName: true },
      })
    : [];
  const orgEnabled = new Set(orgModules.map((m) => m.moduleName));
  const effectiveModules =
    rawAccess.length === 0
      ? [...orgEnabled]
      : rawAccess.filter((m) => m.hasAccess && orgEnabled.has(m.moduleName)).map((m) => m.moduleName);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    passwordHash: user.passwordHash,
    role: user.role,
    organization: user.organization,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    moduleAccess: effectiveModules,
    moduleAccessRaw: rawAccess,
    employee: user.employee
      ? {
          id: user.employee.id,
          employeeCode: user.employee.employeeCode,
          position: user.employee.position,
          phone: user.employee.phone,
          hireDate: user.employee.hireDate,
          salary: user.employee.salary,
          employmentType: user.employee.employmentType,
          status: user.employee.status,
          dateOfBirth: user.employee.dateOfBirth,
          address: user.employee.address,
          department: user.employee.department,
        }
      : null,
  };
}

// ─── Admin: Get Organization Details (full) ────────────────

async function getOrganizationById(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      modules: { select: { moduleName: true, isEnabled: true } },
      _count: { select: { users: true } },
    },
  });
  if (!org) throw new AuthError("Organization not found", 404);

  const users = await prisma.user.findMany({
    where: { organizationId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      lastLoginAt: true,
      role: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return { ...org, users };
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

async function deleteUser(userId: string, caller: { orgId: string | null; isSuper: boolean }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { select: { name: true } } },
  });
  if (!user) throw new AuthError("User not found", 404);

  if (user.role.name === "super_admin") {
    throw new AuthError("Cannot delete a super_admin account", 403);
  }
  if (user.isActive) {
    throw new AuthError("Deactivate the user before deleting", 400);
  }
  if (!caller.isSuper) {
    if (!caller.orgId || user.organizationId !== caller.orgId) {
      throw new AuthError("You can only delete users in your own organization", 403);
    }
  }

  const linkedEmployees = await prisma.employee.findMany({ where: { userId }, select: { id: true } });
  const linkedEmpIds = linkedEmployees.map((e) => e.id);
  if (linkedEmpIds.length) {
    await prisma.employee.updateMany({ where: { managerId: { in: linkedEmpIds } }, data: { managerId: null } });
    await prisma.employee.deleteMany({ where: { id: { in: linkedEmpIds } } });
  }
  await prisma.userModuleAccess.deleteMany({ where: { userId } });
  await prisma.chatbotSession.updateMany({ where: { userId }, data: { userId: null } });
  await prisma.user.delete({ where: { id: userId } });

  logger.info(`User deleted: ${userId} (${user.email})`);
}

// ─── Organization Management ───────────────────────────────

async function listOrganizations(scopeOrgId?: string | null) {
  const where = scopeOrgId ? { id: scopeOrgId } : {};
  return prisma.organization.findMany({
    where,
    include: {
      modules: { select: { moduleName: true, isEnabled: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  });
}

async function createOrganization(data: {
  name: string; slug: string; description?: string; enabledModules?: string[];
  adminEmail?: string; adminPassword?: string; adminFirstName?: string; adminLastName?: string;
}) {
  const existingSlug = await prisma.organization.findUnique({ where: { slug: data.slug.toLowerCase().trim() } });
  if (existingSlug) throw new AuthError("An organization with this slug already exists", 409);

  const org = await prisma.organization.create({
    data: {
      name: data.name.trim(),
      slug: data.slug.toLowerCase().trim(),
      description: data.description?.trim(),
    },
  });

  const modules = data.enabledModules && data.enabledModules.length > 0
    ? data.enabledModules
    : ["dashboard", "hr", "finance", "accounting", "ict", "construction", "workforce", "predictive", "alerts"];

  for (const moduleName of modules) {
    await prisma.orgModule.create({
      data: { organizationId: org.id, moduleName, isEnabled: true },
    });
  }

  // Auto-create an org admin
  const adminEmail = (data.adminEmail || `admin@${data.slug.toLowerCase().trim()}.local`).toLowerCase().trim();
  const adminPassword = data.adminPassword || `${data.slug.toLowerCase().replace(/[^a-z0-9]/g, "")}Admin123!`;
  const adminFirst = data.adminFirstName?.trim() || "Org";
  const adminLast = data.adminLastName?.trim() || "Admin";

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  let adminUser = existingAdmin;
  if (!existingAdmin) {
    const adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
    if (!adminRole) throw new AuthError("Admin role not found. Run seed script.", 500);

    const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: adminFirst,
        lastName: adminLast,
        roleId: adminRole.id,
        organizationId: org.id,
        isActive: true,
      },
    });

    for (const moduleName of modules) {
      await prisma.userModuleAccess.create({
        data: { userId: adminUser.id, moduleName, hasAccess: true },
      });
    }
  }

  logger.info(`Organization created: ${org.name} (admin: ${adminEmail})`);
  return { ...org, adminEmail, adminPassword: existingAdmin ? undefined : adminPassword };
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

async function deleteOrganization(organizationId: string) {
  // Check if org has users
  const userCount = await prisma.user.count({ where: { organizationId } });
  if (userCount > 0) {
    throw new AuthError("Cannot delete organization with active users. Remove or reassign all users first.", 400);
  }
  
  // Delete modules first, then org
  await prisma.orgModule.deleteMany({ where: { organizationId } });
  await prisma.organization.delete({ where: { id: organizationId } });
  logger.info(`Organization deleted: ${organizationId}`);
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
  login, createUser, listUsers, getUserById, updateUserModuleAccess,
  deactivateUser, activateUser, deleteUser,
  listOrganizations, getOrganizationById, createOrganization, updateOrgModules, deleteOrganization,
  refreshTokens, logout, logoutAll,
  getProfile, updateProfile, changePassword,
};

export default authService;
