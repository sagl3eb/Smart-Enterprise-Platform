import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import meService, { MeError } from "../services/me";
import prisma from "../prisma/client";
import { sendSuccess, sendCreated, sendError } from "../utils/response";
import logger from "../utils/logger";

function uid(req: AuthenticatedRequest): string | null {
  return req.user?.userId ?? null;
}

function handle(res: Response, e: unknown): void {
  if (e instanceof MeError) { sendError(res, e.message, e.status); return; }
  logger.error(`/me error: ${(e as Error).message}`);
  sendError(res, "Unexpected error", 500);
}

async function getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = uid(req); if (!id) { sendError(res, "Unauthorized", 401); return; }
    const data = await meService.getProfile(id);
    sendSuccess(res, data, "Profile loaded");
  } catch (e) { handle(res, e); }
}

async function getLeaves(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = uid(req); if (!id) { sendError(res, "Unauthorized", 401); return; }
    const data = await meService.listLeaves(id);
    sendSuccess(res, data);
  } catch (e) { handle(res, e); }
}

async function applyLeave(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = uid(req); if (!id) { sendError(res, "Unauthorized", 401); return; }
    const { leaveTypeId, startDate, endDate, reason } = req.body || {};
    const data = await meService.createLeave(id, { leaveTypeId, startDate, endDate, reason });
    sendCreated(res, data, "Leave request submitted");
  } catch (e) { handle(res, e); }
}

async function cancelLeave(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = uid(req); if (!id) { sendError(res, "Unauthorized", 401); return; }
    const data = await meService.cancelLeave(id, req.params.id);
    sendSuccess(res, data, "Leave request cancelled");
  } catch (e) { handle(res, e); }
}

async function leaveTypes(_req: Request, res: Response): Promise<void> {
  try {
    const data = await meService.listLeaveTypes();
    sendSuccess(res, data);
  } catch (e) { handle(res, e); }
}

async function getTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = uid(req); if (!id) { sendError(res, "Unauthorized", 401); return; }
    const data = await meService.listTickets(id);
    sendSuccess(res, data);
  } catch (e) { handle(res, e); }
}

async function getTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = uid(req); if (!id) { sendError(res, "Unauthorized", 401); return; }
    const data = await meService.getTicket(id, req.params.id);
    sendSuccess(res, data);
  } catch (e) { handle(res, e); }
}

async function createTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = uid(req); if (!id) { sendError(res, "Unauthorized", 401); return; }
    const { title, description, category, priority } = req.body || {};
    const data = await meService.createTicket(id, { title, description, category, priority });
    sendCreated(res, data, "Ticket created");
  } catch (e) { handle(res, e); }
}

async function getAssets(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = uid(req); if (!id) { sendError(res, "Unauthorized", 401); return; }
    const data = await meService.listAssets(id);
    sendSuccess(res, data);
  } catch (e) { handle(res, e); }
}

async function getDirectory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = uid(req); if (!id) { sendError(res, "Unauthorized", 401); return; }
    const caller = await prisma.user.findUnique({
      where: { id },
      select: { organizationId: true, role: { select: { name: true } } },
    });
    const isSuper = caller?.role.name === "super_admin";
    const requestedOrgId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    const scopeOrgId = isSuper ? (requestedOrgId || null) : (caller?.organizationId ?? null);

    const data = await meService.listDirectory(scopeOrgId);
    sendSuccess(res, data);
  } catch (e) { handle(res, e); }
}

export default {
  getProfile,
  getLeaves,
  applyLeave,
  cancelLeave,
  leaveTypes,
  getTickets,
  getTicket,
  createTicket,
  getAssets,
  getDirectory,
};
