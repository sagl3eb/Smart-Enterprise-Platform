import { Response } from "express";
import { ScopedRequest, readOrgFilter, writeOrgId } from "../middleware/callerScope";
import alertService, { AlertError } from "../services/alerts";
import {
  sendSuccess, sendCreated, sendPaginated, sendError,
  sendNotFound, sendBadRequest, parsePagination,
} from "../utils/response";
import logger from "../utils/logger";

async function getAlertRules(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { module, isActive } = req.query;
    const rules = await alertService.getAlertRules({
      module: module as string,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });
    sendSuccess(res, rules, "Alert rules retrieved");
  } catch (error) { logger.error("Get alert rules error:", error); sendError(res, "Failed to retrieve alert rules"); }
}

async function getAlertRuleById(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const rule = await alertService.getAlertRuleById(req.params.id, orgFilter);
    if (!rule) { sendNotFound(res, "Alert rule"); return; }
    sendSuccess(res, rule, "Alert rule retrieved");
  } catch (error) { logger.error("Get alert rule error:", error); sendError(res, "Failed to retrieve alert rule"); }
}

async function createAlertRule(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { name, module, metric, condition, threshold, organizationId: bodyOrgId } = req.body;
    if (!name || !module || !metric || !condition || threshold === undefined) {
      sendBadRequest(res, "Required: name, module, metric, condition, threshold"); return;
    }
    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;
    const rule = await alertService.createAlertRule({
      ...req.body,
      threshold: Number(threshold),
      createdBy: req.user?.userId,
      organizationId: orgId,
    });
    sendCreated(res, rule, "Alert rule created");
  } catch (error) {
    if (error instanceof AlertError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create alert rule error:", error); sendError(res, "Failed to create alert rule");
  }
}

async function updateAlertRule(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const rule = await alertService.updateAlertRule(req.params.id, {
      ...req.body, threshold: req.body.threshold !== undefined ? Number(req.body.threshold) : undefined,
    }, orgFilter);
    sendSuccess(res, rule, "Alert rule updated");
  } catch (error) {
    if (error instanceof AlertError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update alert rule error:", error); sendError(res, "Failed to update alert rule");
  }
}

async function deleteAlertRule(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    await alertService.deleteAlertRule(req.params.id, orgFilter);
    sendSuccess(res, null, "Alert rule deleted");
  } catch (error) {
    if (error instanceof AlertError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete alert rule error:", error); sendError(res, "Failed to delete alert rule");
  }
}

async function getAlerts(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { module, severity, isRead, isResolved } = req.query;
    const result = await alertService.getAlerts({
      page, limit, skip, module: module as string, severity: severity as string,
      isRead: isRead !== undefined ? isRead === "true" : undefined,
      isResolved: isResolved !== undefined ? isResolved === "true" : undefined,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });
    sendPaginated(res, result.alerts, result.total, page, limit, "Alerts retrieved");
  } catch (error) { logger.error("Get alerts error:", error); sendError(res, "Failed to retrieve alerts"); }
}

async function getAlertById(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const alert = await alertService.getAlertById(req.params.id, orgFilter);
    if (!alert) { sendNotFound(res, "Alert"); return; }
    sendSuccess(res, alert, "Alert retrieved");
  } catch (error) { logger.error("Get alert error:", error); sendError(res, "Failed to retrieve alert"); }
}

async function createAlert(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { title, message, module, organizationId: bodyOrgId } = req.body;
    if (!title || !message || !module) { sendBadRequest(res, "Required: title, message, module"); return; }
    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;
    const alert = await alertService.createAlert({ ...req.body, organizationId: orgId });
    sendCreated(res, alert, "Alert created");
  } catch (error) { logger.error("Create alert error:", error); sendError(res, "Failed to create alert"); }
}

async function markAlertRead(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const alert = await alertService.markAlertRead(req.params.id, orgFilter);
    sendSuccess(res, alert, "Alert marked as read");
  } catch (error) {
    if (error instanceof AlertError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Mark read error:", error); sendError(res, "Failed to mark alert as read");
  }
}

async function markAllAlertsRead(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { module } = req.body;
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const count = await alertService.markAllAlertsRead(module, orgFilter);
    sendSuccess(res, { count }, `${count} alerts marked as read`);
  } catch (error) { logger.error("Mark all read error:", error); sendError(res, "Failed to mark all alerts as read"); }
}

async function resolveAlert(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const alert = await alertService.resolveAlert(req.params.id, orgFilter);
    sendSuccess(res, alert, "Alert resolved");
  } catch (error) {
    if (error instanceof AlertError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Resolve alert error:", error); sendError(res, "Failed to resolve alert");
  }
}

async function deleteAlert(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    await alertService.deleteAlert(req.params.id, orgFilter);
    sendSuccess(res, null, "Alert deleted");
  } catch (error) {
    if (error instanceof AlertError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete alert error:", error); sendError(res, "Failed to delete alert");
  }
}

async function getAlertStats(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const stats = await alertService.getAlertStats(orgFilter);
    sendSuccess(res, stats, "Alert statistics retrieved");
  } catch (error) { logger.error("Alert stats error:", error); sendError(res, "Failed to retrieve alert stats"); }
}

async function evaluateAlertRules(_req: ScopedRequest, res: Response): Promise<void> {
  try {
    const result = await alertService.evaluateAlertRules();
    sendSuccess(res, result, "Alert rules evaluated");
  } catch (error) { logger.error("Evaluate rules error:", error); sendError(res, "Failed to evaluate alert rules"); }
}

async function getOptimizationSuggestions(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { module, status, impact } = req.query;
    const result = await alertService.getOptimizationSuggestions({
      page, limit, skip, module: module as string, status: status as string, impact: impact as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });
    sendPaginated(res, result.suggestions, result.total, page, limit, "Suggestions retrieved");
  } catch (error) { logger.error("Get suggestions error:", error); sendError(res, "Failed to retrieve suggestions"); }
}

async function createOptimizationSuggestion(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { module, title, description, impact, effort, organizationId: bodyOrgId } = req.body;
    if (!module || !title || !description || !impact || !effort) {
      sendBadRequest(res, "Required: module, title, description, impact, effort"); return;
    }
    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;
    const suggestion = await alertService.createOptimizationSuggestion({ ...req.body, organizationId: orgId });
    sendCreated(res, suggestion, "Suggestion created");
  } catch (error) { logger.error("Create suggestion error:", error); sendError(res, "Failed to create suggestion"); }
}

async function updateOptimizationSuggestionStatus(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (!status) { sendBadRequest(res, "Status is required"); return; }
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const suggestion = await alertService.updateOptimizationSuggestionStatus(req.params.id, status, orgFilter);
    sendSuccess(res, suggestion, "Suggestion updated");
  } catch (error) {
    if (error instanceof AlertError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update suggestion error:", error); sendError(res, "Failed to update suggestion");
  }
}

async function generateOptimizationSuggestions(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const result = await alertService.generateOptimizationSuggestions(orgFilter);
    sendSuccess(res, result, `Generated ${result.created} suggestions across ${result.scanned.length} modules`);
  } catch (error) { logger.error("Generate suggestions error:", error); sendError(res, "Failed to generate suggestions"); }
}

const alertController = {
  getAlertRules, getAlertRuleById, createAlertRule, updateAlertRule, deleteAlertRule,
  getAlerts, getAlertById, createAlert, markAlertRead, markAllAlertsRead, resolveAlert, deleteAlert, getAlertStats,
  evaluateAlertRules,
  getOptimizationSuggestions, createOptimizationSuggestion, updateOptimizationSuggestionStatus,
  generateOptimizationSuggestions,
};

export default alertController;
