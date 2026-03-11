import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";
import { sendForbidden, sendUnauthorized } from "../utils/response";

export type RoleName = "admin" | "manager" | "employee" | "viewer";

const ROLE_HIERARCHY: Record<RoleName, number> = {
  admin: 40,
  manager: 30,
  employee: 20,
  viewer: 10,
};

export function requireRole(...allowedRoles: RoleName[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    const userRole = req.user.roleName as RoleName;

    if (!allowedRoles.includes(userRole)) {
      sendForbidden(
        res,
        `Access denied. Required role(s): ${allowedRoles.join(", ")}. Your role: ${userRole}`
      );
      return;
    }

    next();
  };
}

export function requireMinRole(minRole: RoleName) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    const userRole = req.user.roleName as RoleName;
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      sendForbidden(
        res,
        `Access denied. Minimum role required: ${minRole}. Your role: ${userRole}`
      );
      return;
    }

    next();
  };
}

export function requireOwnerOrRole(
  getOwnerId: (req: AuthenticatedRequest) => string | Promise<string>,
  ...allowedRoles: RoleName[]
) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    const userRole = req.user.roleName as RoleName;

    if (allowedRoles.includes(userRole)) {
      next();
      return;
    }

    try {
      const ownerId = await getOwnerId(req);
      if (ownerId === req.user.userId) {
        next();
        return;
      }
    } catch {
      sendForbidden(res, "Unable to verify resource ownership");
      return;
    }

    sendForbidden(
      res,
      "Access denied. You must be the resource owner or have one of these roles: " +
        allowedRoles.join(", ")
    );
  };
}
