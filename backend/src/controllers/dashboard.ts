import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import dashboardService, { DashboardError } from "../services/dashboard";
import {
  sendSuccess, sendCreated, sendError,
  sendNotFound, sendBadRequest,
} from "../utils/response";
import logger from "../utils/logger";

async function getKpiDefinitions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { module, isActive } = req.query;
    const kpis = await dashboardService.getKpiDefinitions({
      module: module as string,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
    });
    sendSuccess(res, kpis, "KPI definitions retrieved");
  } catch (error) { logger.error("Get KPIs error:", error); sendError(res, "Failed to retrieve KPIs"); }
}

async function createKpiDefinition(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, module, metric } = req.body;
    if (!name || !module || !metric) { sendBadRequest(res, "Required: name, module, metric"); return; }
    const kpi = await dashboardService.createKpiDefinition({
      ...req.body, target: req.body.target !== undefined ? Number(req.body.target) : undefined,
    });
    sendCreated(res, kpi, "KPI created");
  } catch (error) { logger.error("Create KPI error:", error); sendError(res, "Failed to create KPI"); }
}

async function updateKpiDefinition(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const kpi = await dashboardService.updateKpiDefinition(req.params.id, {
      ...req.body, target: req.body.target !== undefined ? Number(req.body.target) : undefined,
    });
    sendSuccess(res, kpi, "KPI updated");
  } catch (error) { logger.error("Update KPI error:", error); sendError(res, "Failed to update KPI"); }
}

async function recordKpiSnapshot(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { kpiId, value, snapshotDate } = req.body;
    if (!kpiId || value === undefined || !snapshotDate) {
      sendBadRequest(res, "Required: kpiId, value, snapshotDate"); return;
    }
    const snapshot = await dashboardService.recordKpiSnapshot({
      kpiId, value: Number(value), snapshotDate,
      previousValue: req.body.previousValue !== undefined ? Number(req.body.previousValue) : undefined,
    });
    sendCreated(res, snapshot, "KPI snapshot recorded");
  } catch (error) { logger.error("Record snapshot error:", error); sendError(res, "Failed to record snapshot"); }
}

async function getLatestKpis(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const kpis = await dashboardService.getLatestKpis();
    sendSuccess(res, kpis, "Latest KPIs retrieved");
  } catch (error) { logger.error("Latest KPIs error:", error); sendError(res, "Failed to retrieve latest KPIs"); }
}

async function getKpiHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 90;
    const history = await dashboardService.getKpiHistory(req.params.id, days);
    sendSuccess(res, history, "KPI history retrieved");
  } catch (error) { logger.error("KPI history error:", error); sendError(res, "Failed to retrieve KPI history"); }
}

async function getDashboardLayouts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { sendError(res, "Unauthorized", 401); return; }
    const layouts = await dashboardService.getDashboardLayouts(req.user.userId);
    sendSuccess(res, layouts, "Layouts retrieved");
  } catch (error) { logger.error("Get layouts error:", error); sendError(res, "Failed to retrieve layouts"); }
}

async function getDashboardLayoutById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const layout = await dashboardService.getDashboardLayoutById(req.params.id);
    if (!layout) { sendNotFound(res, "Dashboard layout"); return; }
    sendSuccess(res, layout, "Layout retrieved");
  } catch (error) { logger.error("Get layout error:", error); sendError(res, "Failed to retrieve layout"); }
}

async function createDashboardLayout(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { sendError(res, "Unauthorized", 401); return; }
    const { name, layout } = req.body;
    if (!name || !layout) { sendBadRequest(res, "Name and layout are required"); return; }
    const result = await dashboardService.createDashboardLayout({
      ...req.body, userId: req.user.userId,
    });
    sendCreated(res, result, "Layout created");
  } catch (error) { logger.error("Create layout error:", error); sendError(res, "Failed to create layout"); }
}

async function updateDashboardLayout(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const layout = await dashboardService.updateDashboardLayout(req.params.id, req.body);
    sendSuccess(res, layout, "Layout updated");
  } catch (error) {
    if (error instanceof DashboardError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update layout error:", error); sendError(res, "Failed to update layout");
  }
}

async function deleteDashboardLayout(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await dashboardService.deleteDashboardLayout(req.params.id);
    sendSuccess(res, null, "Layout deleted");
  } catch (error) { logger.error("Delete layout error:", error); sendError(res, "Failed to delete layout"); }
}

async function addWidget(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { layoutId, widgetType, title, config, position, size } = req.body;
    if (!layoutId || !widgetType || !title || !config || !position || !size) {
      sendBadRequest(res, "Required: layoutId, widgetType, title, config, position, size"); return;
    }
    const widget = await dashboardService.addWidget(req.body);
    sendCreated(res, widget, "Widget added");
  } catch (error) { logger.error("Add widget error:", error); sendError(res, "Failed to add widget"); }
}

async function updateWidget(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const widget = await dashboardService.updateWidget(req.params.id, req.body);
    sendSuccess(res, widget, "Widget updated");
  } catch (error) { logger.error("Update widget error:", error); sendError(res, "Failed to update widget"); }
}

async function deleteWidget(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await dashboardService.deleteWidget(req.params.id);
    sendSuccess(res, null, "Widget deleted");
  } catch (error) { logger.error("Delete widget error:", error); sendError(res, "Failed to delete widget"); }
}

async function getExecutiveSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const summary = await dashboardService.getExecutiveSummary();
    sendSuccess(res, summary, "Executive summary retrieved");
  } catch (error) { logger.error("Executive summary error:", error); sendError(res, "Failed to retrieve executive summary"); }
}

const dashboardController = {
  getKpiDefinitions, createKpiDefinition, updateKpiDefinition,
  recordKpiSnapshot, getLatestKpis, getKpiHistory,
  getDashboardLayouts, getDashboardLayoutById, createDashboardLayout, updateDashboardLayout, deleteDashboardLayout,
  addWidget, updateWidget, deleteWidget,
  getExecutiveSummary,
};

export default dashboardController;
