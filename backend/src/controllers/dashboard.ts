import { Response } from "express";
import { ScopedRequest, readOrgFilter, writeOrgId } from "../middleware/callerScope";
import dashboardService, { DashboardError } from "../services/dashboard";
import {
  sendSuccess, sendCreated, sendError,
  sendNotFound, sendBadRequest,
} from "../utils/response";
import logger from "../utils/logger";

async function getKpiDefinitions(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { module, isActive } = req.query;
    const kpis = await dashboardService.getKpiDefinitions({
      module: module as string,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });
    sendSuccess(res, kpis, "KPI definitions retrieved");
  } catch (error) { logger.error("Get KPIs error:", error); sendError(res, "Failed to retrieve KPIs"); }
}

async function createKpiDefinition(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { name, module, metric, organizationId: bodyOrgId } = req.body;
    if (!name || !module || !metric) { sendBadRequest(res, "Required: name, module, metric"); return; }
    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;
    const kpi = await dashboardService.createKpiDefinition({
      ...req.body,
      target: req.body.target !== undefined ? Number(req.body.target) : undefined,
      organizationId: orgId,
    });
    sendCreated(res, kpi, "KPI created");
  } catch (error) { logger.error("Create KPI error:", error); sendError(res, "Failed to create KPI"); }
}

async function updateKpiDefinition(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const kpi = await dashboardService.updateKpiDefinition(req.params.id, {
      ...req.body, target: req.body.target !== undefined ? Number(req.body.target) : undefined,
    }, orgFilter);
    sendSuccess(res, kpi, "KPI updated");
  } catch (error) {
    if (error instanceof DashboardError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update KPI error:", error); sendError(res, "Failed to update KPI");
  }
}

async function recordKpiSnapshot(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { kpiId, value, snapshotDate } = req.body;
    if (!kpiId || value === undefined || !snapshotDate) {
      sendBadRequest(res, "Required: kpiId, value, snapshotDate"); return;
    }
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const snapshot = await dashboardService.recordKpiSnapshot({
      kpiId, value: Number(value), snapshotDate,
      previousValue: req.body.previousValue !== undefined ? Number(req.body.previousValue) : undefined,
      organizationId: orgFilter,
    });
    sendCreated(res, snapshot, "KPI snapshot recorded");
  } catch (error) {
    if (error instanceof DashboardError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Record snapshot error:", error); sendError(res, "Failed to record snapshot");
  }
}

async function getLatestKpis(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const kpis = await dashboardService.getLatestKpis(orgFilter);
    sendSuccess(res, kpis, "Latest KPIs retrieved");
  } catch (error) { logger.error("Latest KPIs error:", error); sendError(res, "Failed to retrieve latest KPIs"); }
}

async function getKpiHistory(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 90;
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const history = await dashboardService.getKpiHistory(req.params.id, days, orgFilter);
    sendSuccess(res, history, "KPI history retrieved");
  } catch (error) {
    if (error instanceof DashboardError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("KPI history error:", error); sendError(res, "Failed to retrieve KPI history");
  }
}

async function getDashboardLayouts(req: ScopedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { sendError(res, "Unauthorized", 401); return; }
    const layouts = await dashboardService.getDashboardLayouts(req.user.userId);
    sendSuccess(res, layouts, "Layouts retrieved");
  } catch (error) { logger.error("Get layouts error:", error); sendError(res, "Failed to retrieve layouts"); }
}

async function getDashboardLayoutById(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const userId = req.scope && !req.scope.isSuper ? req.scope.userId : undefined;
    const layout = await dashboardService.getDashboardLayoutById(req.params.id, userId);
    if (!layout) { sendNotFound(res, "Dashboard layout"); return; }
    sendSuccess(res, layout, "Layout retrieved");
  } catch (error) { logger.error("Get layout error:", error); sendError(res, "Failed to retrieve layout"); }
}

async function createDashboardLayout(req: ScopedRequest, res: Response): Promise<void> {
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

async function updateDashboardLayout(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const userId = req.scope && !req.scope.isSuper ? req.scope.userId : undefined;
    const layout = await dashboardService.updateDashboardLayout(req.params.id, req.body, userId);
    sendSuccess(res, layout, "Layout updated");
  } catch (error) {
    if (error instanceof DashboardError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update layout error:", error); sendError(res, "Failed to update layout");
  }
}

async function deleteDashboardLayout(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const userId = req.scope && !req.scope.isSuper ? req.scope.userId : undefined;
    await dashboardService.deleteDashboardLayout(req.params.id, userId);
    sendSuccess(res, null, "Layout deleted");
  } catch (error) {
    if (error instanceof DashboardError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete layout error:", error); sendError(res, "Failed to delete layout");
  }
}

async function addWidget(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { layoutId, widgetType, title, config, position, size } = req.body;
    if (!layoutId || !widgetType || !title || !config || !position || !size) {
      sendBadRequest(res, "Required: layoutId, widgetType, title, config, position, size"); return;
    }
    const userId = req.scope && !req.scope.isSuper ? req.scope.userId : undefined;
    const widget = await dashboardService.addWidget(req.body, userId);
    sendCreated(res, widget, "Widget added");
  } catch (error) {
    if (error instanceof DashboardError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Add widget error:", error); sendError(res, "Failed to add widget");
  }
}

async function updateWidget(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const userId = req.scope && !req.scope.isSuper ? req.scope.userId : undefined;
    const widget = await dashboardService.updateWidget(req.params.id, req.body, userId);
    sendSuccess(res, widget, "Widget updated");
  } catch (error) {
    if (error instanceof DashboardError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update widget error:", error); sendError(res, "Failed to update widget");
  }
}

async function deleteWidget(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const userId = req.scope && !req.scope.isSuper ? req.scope.userId : undefined;
    await dashboardService.deleteWidget(req.params.id, userId);
    sendSuccess(res, null, "Widget deleted");
  } catch (error) {
    if (error instanceof DashboardError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete widget error:", error); sendError(res, "Failed to delete widget");
  }
}

async function getExecutiveSummary(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const summary = await dashboardService.getExecutiveSummary(orgFilter);
    sendSuccess(res, summary, "Executive summary retrieved");
  } catch (error) { logger.error("Executive summary error:", error); sendError(res, "Failed to retrieve executive summary"); }
}

async function getDashboardCharts(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const charts = await dashboardService.getDashboardCharts(orgFilter);
    sendSuccess(res, charts, "Dashboard charts retrieved");
  } catch (error) { logger.error("Dashboard charts error:", error); sendError(res, "Failed to retrieve dashboard charts"); }
}

const dashboardController = {
  getKpiDefinitions, createKpiDefinition, updateKpiDefinition,
  recordKpiSnapshot, getLatestKpis, getKpiHistory,
  getDashboardLayouts, getDashboardLayoutById, createDashboardLayout, updateDashboardLayout, deleteDashboardLayout,
  addWidget, updateWidget, deleteWidget,
  getExecutiveSummary, getDashboardCharts,
};

export default dashboardController;
