import { Response, NextFunction } from "express";
import prisma from "../prisma/client";
import { AuthenticatedRequest } from "./auth";
import { sendUnauthorized } from "../utils/response";

export interface CallerScope {
  userId: string;
  orgId: string | null;
  roleName: string;
  isSuper: boolean;
}

export interface ScopedRequest extends AuthenticatedRequest {
  scope?: CallerScope;
}

/**
 * Resolves the caller's current organization + role by reading from DB
 * (JWT can be stale after role/org changes). Attaches `req.scope`.
 *
 * For super_admin, honors `?organizationId=<uuid>` query param as a filter override.
 * Non-super-admin callers always get their own organizationId regardless of query.
 */
export async function attachScope(
  req: ScopedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) { sendUnauthorized(res, "Unauthorized"); return; }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { organizationId: true, role: { select: { name: true } } },
  });
  if (!user) { sendUnauthorized(res, "User no longer exists"); return; }

  const isSuper = user.role.name === "super_admin";
  let orgId: string | null = user.organizationId;

  if (isSuper) {
    const filterParam = typeof req.query.organizationId === "string" ? req.query.organizationId : null;
    orgId = filterParam && filterParam.length > 0 ? filterParam : null;
  }

  req.scope = {
    userId: req.user.userId,
    orgId,
    roleName: user.role.name,
    isSuper,
  };
  next();
}

/**
 * Helper: get the effective org filter for reads.
 * Returns `undefined` for super_admin with no filter (see all orgs).
 * Returns the scope's orgId otherwise.
 */
export function readOrgFilter(scope: CallerScope): string | undefined {
  if (scope.isSuper) {
    return scope.orgId || undefined;
  }
  return scope.orgId || undefined;
}

/**
 * Helper: get the org to stamp on a new record.
 * Super_admin must either have a filter set OR pass organizationId in the body.
 * Non-super-admin always gets their own orgId.
 */
export function writeOrgId(scope: CallerScope, bodyOrgId?: string): string {
  if (scope.isSuper) {
    const chosen = bodyOrgId || scope.orgId;
    if (!chosen) {
      throw new Error("Super admin must specify organizationId to create records");
    }
    return chosen;
  }
  if (!scope.orgId) {
    throw new Error("Caller has no organization");
  }
  return scope.orgId;
}
