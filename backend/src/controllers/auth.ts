import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import authService, { AuthError } from "../services/auth";
import {
  sendSuccess,
  sendCreated,
  sendError,
  sendBadRequest,
} from "../utils/response";
import logger from "../utils/logger";

async function register(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { email, password, firstName, lastName, roleName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      sendBadRequest(res, "Email, password, firstName, and lastName are required");
      return;
    }

    if (password.length < 8) {
      sendBadRequest(res, "Password must be at least 8 characters");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      sendBadRequest(res, "Invalid email format");
      return;
    }

    const result = await authService.register({
      email,
      password,
      firstName,
      lastName,
      roleName,
    });

    sendCreated(res, result, "Registration successful");
  } catch (error) {
    if (error instanceof AuthError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Register error:", error);
    sendError(res, "Registration failed");
  }
}

async function login(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      sendBadRequest(res, "Email and password are required");
      return;
    }

    const result = await authService.login({ email, password });

    sendSuccess(res, result, "Login successful");
  } catch (error) {
    if (error instanceof AuthError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Login error:", error);
    sendError(res, "Login failed");
  }
}

async function refresh(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      sendBadRequest(res, "Refresh token is required");
      return;
    }

    const tokens = await authService.refreshTokens(refreshToken);

    sendSuccess(res, tokens, "Tokens refreshed successfully");
  } catch (error) {
    if (error instanceof AuthError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Refresh error:", error);
    sendError(res, "Token refresh failed");
  }
}

async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      sendBadRequest(res, "Refresh token is required");
      return;
    }

    if (!req.user) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    await authService.logout(refreshToken, req.user.userId);

    sendSuccess(res, null, "Logged out successfully");
  } catch (error) {
    logger.error("Logout error:", error);
    sendError(res, "Logout failed");
  }
}

async function logoutAll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    const count = await authService.logoutAll(req.user.userId);

    sendSuccess(res, { revokedSessions: count }, "All sessions revoked");
  } catch (error) {
    logger.error("Logout all error:", error);
    sendError(res, "Failed to revoke all sessions");
  }
}

async function getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    const profile = await authService.getProfile(req.user.userId);

    sendSuccess(res, profile, "Profile retrieved");
  } catch (error) {
    if (error instanceof AuthError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Get profile error:", error);
    sendError(res, "Failed to retrieve profile");
  }
}

async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    const { firstName, lastName, avatar } = req.body;

    const profile = await authService.updateProfile(req.user.userId, {
      firstName,
      lastName,
      avatar,
    });

    sendSuccess(res, profile, "Profile updated");
  } catch (error) {
    if (error instanceof AuthError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Update profile error:", error);
    sendError(res, "Failed to update profile");
  }
}

async function changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      sendBadRequest(res, "Current password and new password are required");
      return;
    }

    if (newPassword.length < 8) {
      sendBadRequest(res, "New password must be at least 8 characters");
      return;
    }

    await authService.changePassword(req.user.userId, currentPassword, newPassword);

    sendSuccess(res, null, "Password changed successfully. Please login again.");
  } catch (error) {
    if (error instanceof AuthError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Change password error:", error);
    sendError(res, "Failed to change password");
  }
}

const authController = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getProfile,
  updateProfile,
  changePassword,
};

export default authController;
