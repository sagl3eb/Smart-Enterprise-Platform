import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import authService, { AuthError } from "../services/auth";
import { sendSuccess, sendCreated, sendError, sendBadRequest } from "../utils/response";
import logger from "../utils/logger";
import prisma from "../prisma/client";

async function getCallerScope(req: AuthenticatedRequest): Promise<{ orgId: string | null; isSuper: boolean }> {
  if (!req.user) return { orgId: null, isSuper: false };
  // Always re-read role from DB (JWT can be stale after a role change)
  const u = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { organizationId: true, role: { select: { name: true } } },
  });
  const roleName = u?.role.name ?? req.user.roleName;
  if (roleName === "super_admin") return { orgId: null, isSuper: true };
  return { orgId: u?.organizationId ?? null, isSuper: false };
}

async function login(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) { sendBadRequest(res, "Email and password are required"); return; }
    const result = await authService.login({ email, password });
    sendSuccess(res, result, "Login successful");
  } catch (error) {
    if (error instanceof AuthError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Login error:", error);
    sendError(res, "Login failed");
  }
}

async function createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { sendError(res, "Unauthorized", 401); return; }
    const { email, password, firstName, lastName, roleName, organizationId, moduleAccess } = req.body;
    if (!email || !password || !firstName || !lastName || !roleName || !organizationId) {
      sendBadRequest(res, "Required: email, password, firstName, lastName, roleName, organizationId"); return;
    }
    if (password.length < 8) { sendBadRequest(res, "Password must be at least 8 characters"); return; }
    const user = await authService.createUser({ email, password, firstName, lastName, roleName, organizationId, moduleAccess }, req.user.userId);
    sendCreated(res, user, "User created successfully");
  } catch (error) {
    if (error instanceof AuthError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create user error:", error);
    sendError(res, "Failed to create user");
  }
}

async function listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { organizationId } = req.query;
    const scope = await getCallerScope(req);
    const effectiveOrgId = scope.isSuper ? (organizationId as string | undefined) : (scope.orgId || undefined);
    const users = await authService.listUsers(effectiveOrgId);
    sendSuccess(res, users, "Users retrieved");
  } catch (error) { logger.error("List users error:", error); sendError(res, "Failed to list users"); }
}

async function getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = await authService.getUserById(req.params.userId);
    sendSuccess(res, user, "User details retrieved");
  } catch (error) {
    if (error instanceof AuthError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Get user error:", error);
    sendError(res, "Failed to retrieve user");
  }
}

async function getOrganizationById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const org = await authService.getOrganizationById(req.params.orgId);
    sendSuccess(res, org, "Organization details retrieved");
  } catch (error) {
    if (error instanceof AuthError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Get org error:", error);
    sendError(res, "Failed to retrieve organization");
  }
}

async function updateUserModuleAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { modules } = req.body;
    if (!modules || !Array.isArray(modules)) { sendBadRequest(res, "Modules array required"); return; }
    const result = await authService.updateUserModuleAccess(req.params.userId, modules);
    sendSuccess(res, result, "Module access updated");
  } catch (error) { logger.error("Update module access error:", error); sendError(res, "Failed to update module access"); }
}

async function deactivateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await authService.deactivateUser(req.params.userId);
    sendSuccess(res, null, "User deactivated");
  } catch (error) { logger.error("Deactivate user error:", error); sendError(res, "Failed to deactivate user"); }
}

async function activateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await authService.activateUser(req.params.userId);
    sendSuccess(res, null, "User activated");
  } catch (error) { logger.error("Activate user error:", error); sendError(res, "Failed to activate user"); }
}

async function deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { sendError(res, "Unauthorized", 401); return; }
    const scope = await getCallerScope(req);
    await authService.deleteUser(req.params.userId, scope);
    sendSuccess(res, null, "User deleted");
  } catch (error) {
    if (error instanceof AuthError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete user error:", error);
    sendError(res, "Failed to delete user");
  }
}

async function listOrganizations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = await getCallerScope(req);
    const orgs = await authService.listOrganizations(scope.isSuper ? null : scope.orgId);
    sendSuccess(res, orgs, "Organizations retrieved");
  } catch (error) { logger.error("List orgs error:", error); sendError(res, "Failed to list organizations"); }
}

async function createOrganization(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, slug, description, enabledModules, adminEmail, adminPassword, adminFirstName, adminLastName } = req.body;
    if (!name || !slug) { sendBadRequest(res, "Name and slug required"); return; }
    const org = await authService.createOrganization({ name, slug, description, enabledModules, adminEmail, adminPassword, adminFirstName, adminLastName });
    sendCreated(res, org, "Organization created");
  } catch (error) {
    if (error instanceof AuthError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create org error:", error);
    sendError(res, "Failed to create organization");
  }
}

async function updateOrgModules(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { modules } = req.body;
    if (!modules || !Array.isArray(modules)) { sendBadRequest(res, "Modules array required"); return; }
    const result = await authService.updateOrgModules(req.params.orgId, modules);
    sendSuccess(res, result, "Organization modules updated");
  } catch (error) { logger.error("Update org modules error:", error); sendError(res, "Failed to update org modules"); }
}

async function deleteOrganization(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await authService.deleteOrganization(req.params.orgId);
    sendSuccess(res, null, "Organization deleted");
  } catch (error) {
    if (error instanceof AuthError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete org error:", error);
    sendError(res, "Failed to delete organization");
  }
}

async function refresh(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { sendBadRequest(res, "Refresh token required"); return; }
    const tokens = await authService.refreshTokens(refreshToken);
    sendSuccess(res, tokens, "Tokens refreshed");
  } catch (error) {
    if (error instanceof AuthError) { sendError(res, error.message, error.statusCode); return; }
    sendError(res, "Token refresh failed");
  }
}

async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken || !req.user) { sendBadRequest(res, "Refresh token required"); return; }
    await authService.logout(refreshToken, req.user.userId);
    sendSuccess(res, null, "Logged out");
  } catch (error) { sendError(res, "Logout failed"); }
}

async function logoutAll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { sendError(res, "Unauthorized", 401); return; }
    const count = await authService.logoutAll(req.user.userId);
    sendSuccess(res, { revokedSessions: count }, "All sessions revoked");
  } catch (error) { sendError(res, "Failed to revoke sessions"); }
}

async function getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { sendError(res, "Unauthorized", 401); return; }
    const profile = await authService.getProfile(req.user.userId);
    sendSuccess(res, profile, "Profile retrieved");
  } catch (error) {
    if (error instanceof AuthError) { sendError(res, error.message, error.statusCode); return; }
    sendError(res, "Failed to retrieve profile");
  }
}

async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { sendError(res, "Unauthorized", 401); return; }
    const profile = await authService.updateProfile(req.user.userId, req.body);
    sendSuccess(res, profile, "Profile updated");
  } catch (error) { sendError(res, "Failed to update profile"); }
}

async function changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { sendError(res, "Unauthorized", 401); return; }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) { sendBadRequest(res, "Current and new password required"); return; }
    if (newPassword.length < 8) { sendBadRequest(res, "New password must be at least 8 characters"); return; }
    await authService.changePassword(req.user.userId, currentPassword, newPassword);
    sendSuccess(res, null, "Password changed. Please login again.");
  } catch (error) {
    if (error instanceof AuthError) { sendError(res, error.message, error.statusCode); return; }
    sendError(res, "Failed to change password");
  }
}

async function getRoles(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const p = new PrismaClient();
    const roles = await p.role.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    await p.$disconnect();
    sendSuccess(res, roles, "Roles retrieved");
  } catch (error) { sendError(res, "Failed to retrieve roles"); }
}

const authController = {
  login, createUser, listUsers, getUserById, updateUserModuleAccess, deactivateUser, activateUser, deleteUser,
  listOrganizations, getOrganizationById, createOrganization, updateOrgModules, deleteOrganization,
  refresh, logout, logoutAll, getProfile, updateProfile, changePassword, getRoles,
};

export default authController;
