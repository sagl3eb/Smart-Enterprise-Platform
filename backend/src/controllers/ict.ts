import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import ictService, { IctError } from "../services/ict";
import {
  sendSuccess, sendCreated, sendPaginated, sendError,
  sendNotFound, sendBadRequest, parsePagination,
} from "../utils/response";
import logger from "../utils/logger";

// ─── ASSETS ────────────────────────────────────────────────

async function getAssets(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { category, status, search, assignedTo } = req.query;
    const result = await ictService.getAssets({
      page, limit, skip,
      category: category as string, status: status as string,
      search: search as string, assignedTo: assignedTo as string,
    });
    sendPaginated(res, result.assets, result.total, page, limit, "Assets retrieved");
  } catch (error) { logger.error("Get assets error:", error); sendError(res, "Failed to retrieve assets"); }
}

async function getAssetById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const asset = await ictService.getAssetById(req.params.id);
    if (!asset) { sendNotFound(res, "Asset"); return; }
    sendSuccess(res, asset, "Asset retrieved");
  } catch (error) { logger.error("Get asset error:", error); sendError(res, "Failed to retrieve asset"); }
}

async function createAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { assetTag, name, category } = req.body;
    if (!assetTag || !name || !category) { sendBadRequest(res, "Asset tag, name, and category are required"); return; }
    const asset = await ictService.createAsset({
      ...req.body,
      purchasePrice: req.body.purchasePrice !== undefined ? Number(req.body.purchasePrice) : undefined,
    });
    sendCreated(res, asset, "Asset created");
  } catch (error) {
    if (error instanceof IctError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create asset error:", error); sendError(res, "Failed to create asset");
  }
}

async function updateAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const asset = await ictService.updateAsset(req.params.id, req.body);
    sendSuccess(res, asset, "Asset updated");
  } catch (error) {
    if (error instanceof IctError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update asset error:", error); sendError(res, "Failed to update asset");
  }
}

async function deleteAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await ictService.deleteAsset(req.params.id);
    sendSuccess(res, null, "Asset deleted");
  } catch (error) {
    if (error instanceof IctError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete asset error:", error); sendError(res, "Failed to delete asset");
  }
}

async function getAssetStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const stats = await ictService.getAssetStats();
    sendSuccess(res, stats, "Asset statistics retrieved");
  } catch (error) { logger.error("Asset stats error:", error); sendError(res, "Failed to retrieve asset statistics"); }
}

// ─── SOFTWARE LICENSES ─────────────────────────────────────

async function getSoftwareLicenses(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { status, search } = req.query;
    const result = await ictService.getSoftwareLicenses({
      page, limit, skip, status: status as string, search: search as string,
    });
    sendPaginated(res, result.licenses, result.total, page, limit, "Licenses retrieved");
  } catch (error) { logger.error("Get licenses error:", error); sendError(res, "Failed to retrieve licenses"); }
}

async function getSoftwareLicenseById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const license = await ictService.getSoftwareLicenseById(req.params.id);
    if (!license) { sendNotFound(res, "Software license"); return; }
    sendSuccess(res, license, "License retrieved");
  } catch (error) { logger.error("Get license error:", error); sendError(res, "Failed to retrieve license"); }
}

async function createSoftwareLicense(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { softwareName, licenseType, totalSeats, purchaseDate } = req.body;
    if (!softwareName || !licenseType || totalSeats === undefined || !purchaseDate) {
      sendBadRequest(res, "Required: softwareName, licenseType, totalSeats, purchaseDate"); return;
    }
    const license = await ictService.createSoftwareLicense({
      ...req.body,
      totalSeats: Number(totalSeats),
      annualCost: req.body.annualCost !== undefined ? Number(req.body.annualCost) : undefined,
    });
    sendCreated(res, license, "License created");
  } catch (error) { logger.error("Create license error:", error); sendError(res, "Failed to create license"); }
}

async function updateSoftwareLicense(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const license = await ictService.updateSoftwareLicense(req.params.id, {
      ...req.body,
      totalSeats: req.body.totalSeats !== undefined ? Number(req.body.totalSeats) : undefined,
      usedSeats: req.body.usedSeats !== undefined ? Number(req.body.usedSeats) : undefined,
      annualCost: req.body.annualCost !== undefined ? Number(req.body.annualCost) : undefined,
    });
    sendSuccess(res, license, "License updated");
  } catch (error) { logger.error("Update license error:", error); sendError(res, "Failed to update license"); }
}

async function deleteSoftwareLicense(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await ictService.deleteSoftwareLicense(req.params.id);
    sendSuccess(res, null, "License deleted");
  } catch (error) { logger.error("Delete license error:", error); sendError(res, "Failed to delete license"); }
}

// ─── IT TICKETS ────────────────────────────────────────────

async function getItTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { category, priority, status, assignedTo, search } = req.query;
    const result = await ictService.getItTickets({
      page, limit, skip,
      category: category as string, priority: priority as string,
      status: status as string, assignedTo: assignedTo as string,
      search: search as string,
    });
    sendPaginated(res, result.tickets, result.total, page, limit, "Tickets retrieved");
  } catch (error) { logger.error("Get tickets error:", error); sendError(res, "Failed to retrieve tickets"); }
}

async function getItTicketById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const ticket = await ictService.getItTicketById(req.params.id);
    if (!ticket) { sendNotFound(res, "IT ticket"); return; }
    sendSuccess(res, ticket, "Ticket retrieved");
  } catch (error) { logger.error("Get ticket error:", error); sendError(res, "Failed to retrieve ticket"); }
}

async function createItTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { ticketNumber, title, description, category, reportedBy } = req.body;
    if (!ticketNumber || !title || !description || !category || !reportedBy) {
      sendBadRequest(res, "Required: ticketNumber, title, description, category, reportedBy"); return;
    }
    const ticket = await ictService.createItTicket(req.body);
    sendCreated(res, ticket, "Ticket created");
  } catch (error) {
    if (error instanceof IctError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create ticket error:", error); sendError(res, "Failed to create ticket");
  }
}

async function updateItTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const ticket = await ictService.updateItTicket(req.params.id, req.body);
    sendSuccess(res, ticket, "Ticket updated");
  } catch (error) {
    if (error instanceof IctError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update ticket error:", error); sendError(res, "Failed to update ticket");
  }
}

async function deleteItTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await ictService.deleteItTicket(req.params.id);
    sendSuccess(res, null, "Ticket deleted");
  } catch (error) { logger.error("Delete ticket error:", error); sendError(res, "Failed to delete ticket"); }
}

async function getTicketStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const stats = await ictService.getTicketStats();
    sendSuccess(res, stats, "Ticket statistics retrieved");
  } catch (error) { logger.error("Ticket stats error:", error); sendError(res, "Failed to retrieve ticket statistics"); }
}

async function getTicketSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const summary = await ictService.getTicketSummary();
    sendSuccess(res, summary, "Ticket summary retrieved");
  } catch (error) { logger.error("Ticket summary error:", error); sendError(res, "Failed to retrieve ticket summary"); }
}

// ─── NETWORK DEVICES ───────────────────────────────────────

async function getNetworkDevices(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { type, status, search } = req.query;
    const result = await ictService.getNetworkDevices({
      page, limit, skip, type: type as string, status: status as string, search: search as string,
    });
    sendPaginated(res, result.devices, result.total, page, limit, "Network devices retrieved");
  } catch (error) { logger.error("Get network devices error:", error); sendError(res, "Failed to retrieve network devices"); }
}

async function getNetworkDeviceById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const device = await ictService.getNetworkDeviceById(req.params.id);
    if (!device) { sendNotFound(res, "Network device"); return; }
    sendSuccess(res, device, "Network device retrieved");
  } catch (error) { logger.error("Get network device error:", error); sendError(res, "Failed to retrieve network device"); }
}

async function createNetworkDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, type } = req.body;
    if (!name || !type) { sendBadRequest(res, "Name and type are required"); return; }
    const device = await ictService.createNetworkDevice(req.body);
    sendCreated(res, device, "Network device created");
  } catch (error) { logger.error("Create network device error:", error); sendError(res, "Failed to create network device"); }
}

async function updateNetworkDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const device = await ictService.updateNetworkDevice(req.params.id, req.body);
    sendSuccess(res, device, "Network device updated");
  } catch (error) { logger.error("Update network device error:", error); sendError(res, "Failed to update network device"); }
}

async function deleteNetworkDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await ictService.deleteNetworkDevice(req.params.id);
    sendSuccess(res, null, "Network device deleted");
  } catch (error) { logger.error("Delete network device error:", error); sendError(res, "Failed to delete network device"); }
}

// ─── SYSTEM HEALTH ─────────────────────────────────────────

async function getSystemHealthLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { deviceId, metricName, status, startDate, endDate } = req.query;
    const result = await ictService.getSystemHealthLogs({
      page, limit, skip,
      deviceId: deviceId as string, metricName: metricName as string,
      status: status as string, startDate: startDate as string, endDate: endDate as string,
    });
    sendPaginated(res, result.logs, result.total, page, limit, "Health logs retrieved");
  } catch (error) { logger.error("Get health logs error:", error); sendError(res, "Failed to retrieve health logs"); }
}

async function createSystemHealthLog(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { metricName, metricValue } = req.body;
    if (!metricName || metricValue === undefined) {
      sendBadRequest(res, "Metric name and value are required"); return;
    }
    const log = await ictService.createSystemHealthLog({
      ...req.body, metricValue: Number(metricValue),
    });
    sendCreated(res, log, "Health log recorded");
  } catch (error) { logger.error("Create health log error:", error); sendError(res, "Failed to record health log"); }
}

const ictController = {
  getAssets, getAssetById, createAsset, updateAsset, deleteAsset, getAssetStats,
  getSoftwareLicenses, getSoftwareLicenseById, createSoftwareLicense, updateSoftwareLicense, deleteSoftwareLicense,
  getItTickets, getItTicketById, createItTicket, updateItTicket, deleteItTicket, getTicketStats, getTicketSummary,
  getNetworkDevices, getNetworkDeviceById, createNetworkDevice, updateNetworkDevice, deleteNetworkDevice,
  getSystemHealthLogs, createSystemHealthLog,
};

export default ictController;
