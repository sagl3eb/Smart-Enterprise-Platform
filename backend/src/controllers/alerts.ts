import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import alertService, { AlertError } from "../services/alerts";
import {
  sendSuccess, sendCreated, sendPaginated, sendError,
  sendNotFound, sendBadRequest, parsePagination,
} from "../utils/response";
import logger from "../utils/logger";

async function getAlertRules(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { module, isActive } = req.query;
    const rules = await alertService.getAlertRules({
      module: module as string,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
    });
    sendSuccess(res, rules, "Alert rules retrieved");
  } catch (error) { logger.error("Get alert rules error:", error); sendError(res, "Failed to retrieve alert rules"); }
}

async function getAlertRuleById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rule = await alertService.getAlertRuleById(req.params.id);
    if (!rule) { sendNotFound(res, "Alert rule"); return; }
    sendSuccess(res, rule, "Alert rule retrieved");
  } catch (error) { logger.error("Get alert rule error:", error); sendError(res, "Failed to retrieve alert rule"); }
}

async function createAlertRule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, module, metric, condition, threshold } = req.body;
    if (!name || !module || !metric || !condition || threshold === undefined) {
      sendBadRequest(res, "Required: name, module, metric, condition, threshold"); return;
    }
    const rule = await alertService.createAlertRule({
      ...req.body, threshold: Number(threshold), createdBy: req.user?.userId,
    });
    sendCreated(res, rule, "Alert rule created");
  } catch (error) {
    if (error instanceof AlertError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create alert rule error:", error); sendError(res, "Failed to create alert rule");
  }
}

async function updateAlertRule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rule = await alertService.updateAlertRule(req.params.id, {
      ...req.body, threshold: req.body.threshold !== undefined ? Number(req.body.threshold) : undefined,
    });
    sendSuccess(res, rule, "Alert rule updated");
  } catch (error) { logger.error("Update alert rule error:", error); sendError(res, "Failed to update alert rule"); }
}

async function deleteAlertRule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await alertService.deleteAlertRule(req.params.id);
    sendSuccess(res, null, "Alert rule deleted");
  } catch (error) { logger.error("Delete alert rule error:", error); sendError(res, "Failed to delete alert rule"); }
}

async function getAlerts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { module, severity, isRead, isResolved } = req.query;
    const result = await alertService.getAlerts({
      page, limit, skip, module: module as string, severity: severity as string,
      isRead: isRead !== undefined ? isRead === "true" : undefined,
      isResolved: isResolved !== undefined ? isResolved === "true" : undefined,
    });
    sendPaginated(res, result.alerts, result.total, page, limit, "Alerts retrieved");
  } catch (error) { logger.error("Get alerts error:", error); sendError(res, "Failed to retrieve alerts"); }
}

async function getAlertById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const alert = await alertService.getAlertById(req.params.id);
    if (!alert) { sendNotFound(res, "Alert"); return; }
    sendSuccess(res, alert, "Alert retrieved");
  } catch (error) { logger.error("Get alert error:", error); sendError(res, "Failed to retrieve alert"); }
}

async function createAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { title, message, module } = req.body;
    if (!title || !message || !module) { sendBadRequest(res, "Required: title, message, module"); return; }
    const alert = await alertService.createAlert(req.body);
    sendCreated(res, alert, "Alert created");
  } catch (error) { logger.error("Create alert error:", error); sendError(res, "Failed to create alert"); }
}

async function markAlertRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const alert = await alertService.markAlertRead(req.params.id);
    sendSuccess(res, alert, "Alert marked as read");
  } catch (error) { logger.error("Mark read error:", error); sendError(res, "Failed to mark alert as read"); }
}

async function markAllAlertsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { module } = req.body;
    const count = await alertService.markAllAlertsRead(module);
    sendSuccess(res, { count }, `${count} alerts marked as read`);
  } catch (error) { logger.error("Mark all read error:", error); sendError(res, "Failed to mark all alerts as read"); }
}

async function resolveAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const alert = await alertService.resolveAlert(req.params.id);
    sendSuccess(res, alert, "Alert resolved");
  } catch (error) { logger.error("Resolve alert error:", error); sendError(res, "Failed to resolve alert"); }
}

async function deleteAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await alertService.deleteAlert(req.params.id);
    sendSuccess(res, null, "Alert deleted");
  } catch (error) { logger.error("Delete alert error:", error); sendError(res, "Failed to delete alert"); }
}

async function getAlertStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const stats = await alertService.getAlertStats();
    sendSuccess(res, stats, "Alert statistics retrieved");
  } catch (error) { logger.error("Alert stats error:", error); sendError(res, "Failed to retrieve alert stats"); }
}

async function evaluateAlertRules(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await alertService.evaluateAlertRules();
    sendSuccess(res, result, "Alert rules evaluated");
  } catch (error) { logger.error("Evaluate rules error:", error); sendError(res, "Failed to evaluate alert rules"); }
}

async function getOptimizationSuggestions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { module, status, impact } = req.query;
    const result = await alertService.getOptimizationSuggestions({
      page, limit, skip, module: module as string, status: status as string, impact: impact as string,
    });
    sendPaginated(res, result.suggestions, result.total, page, limit, "Suggestions retrieved");
  } catch (error) { logger.error("Get suggestions error:", error); sendError(res, "Failed to retrieve suggestions"); }
}

async function createOptimizationSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { module, title, description, impact, effort } = req.body;
    if (!module || !title || !description || !impact || !effort) {
      sendBadRequest(res, "Required: module, title, description, impact, effort"); return;
    }
    const suggestion = await alertService.createOptimizationSuggestion(req.body);
    sendCreated(res, suggestion, "Suggestion created");
  } catch (error) { logger.error("Create suggestion error:", error); sendError(res, "Failed to create suggestion"); }
}

async function updateOptimizationSuggestionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (!status) { sendBadRequest(res, "Status is required"); return; }
    const suggestion = await alertService.updateOptimizationSuggestionStatus(req.params.id, status);
    sendSuccess(res, suggestion, "Suggestion updated");
  } catch (error) { logger.error("Update suggestion error:", error); sendError(res, "Failed to update suggestion"); }
}

const alertController = {
  getAlertRules, getAlertRuleById, createAlertRule, updateAlertRule, deleteAlertRule,
  getAlerts, getAlertById, createAlert, markAlertRead, markAllAlertsRead, resolveAlert, deleteAlert, getAlertStats,
  evaluateAlertRules,
  getOptimizationSuggestions, createOptimizationSuggestion, updateOptimizationSuggestionStatus,
};

export default alertController;
