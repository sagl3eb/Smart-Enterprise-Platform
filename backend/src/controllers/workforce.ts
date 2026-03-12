import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import workforceService, { WorkforceError } from "../services/workforce";
import {
  sendSuccess, sendCreated, sendPaginated, sendError,
  sendNotFound, sendBadRequest, parsePagination,
} from "../utils/response";
import logger from "../utils/logger";

async function getAttritionPredictions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { departmentId, riskLevel, employeeId } = req.query;
    const result = await workforceService.getAttritionPredictions({
      page, limit, skip,
      departmentId: departmentId as string, riskLevel: riskLevel as string, employeeId: employeeId as string,
    });
    sendPaginated(res, result.predictions, result.total, page, limit, "Attrition predictions retrieved");
  } catch (error) { logger.error("Get attrition predictions error:", error); sendError(res, "Failed to retrieve predictions"); }
}

async function getAttritionSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const summary = await workforceService.getAttritionSummary();
    sendSuccess(res, summary, "Attrition summary retrieved");
  } catch (error) { logger.error("Attrition summary error:", error); sendError(res, "Failed to retrieve attrition summary"); }
}

async function createAttritionPrediction(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employeeId, departmentId, riskScore, riskLevel, topFactors } = req.body;
    if (!employeeId || !departmentId || riskScore === undefined || !riskLevel || !topFactors) {
      sendBadRequest(res, "Required: employeeId, departmentId, riskScore, riskLevel, topFactors"); return;
    }
    const prediction = await workforceService.createAttritionPrediction({
      ...req.body, riskScore: Number(riskScore),
    });
    sendCreated(res, prediction, "Prediction created");
  } catch (error) { logger.error("Create prediction error:", error); sendError(res, "Failed to create prediction"); }
}

async function bulkCreateAttritionPredictions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { predictions } = req.body;
    if (!predictions || !Array.isArray(predictions)) { sendBadRequest(res, "Predictions array required"); return; }
    const results = await workforceService.bulkCreateAttritionPredictions(predictions);
    sendCreated(res, { count: results.length }, `${results.length} predictions created`);
  } catch (error) { logger.error("Bulk predictions error:", error); sendError(res, "Failed to create bulk predictions"); }
}

async function getWorkforceSnapshots(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { departmentId, startDate, endDate } = req.query;
    const snapshots = await workforceService.getWorkforceSnapshots({
      departmentId: departmentId as string, startDate: startDate as string, endDate: endDate as string,
    });
    sendSuccess(res, snapshots, "Workforce snapshots retrieved");
  } catch (error) { logger.error("Get snapshots error:", error); sendError(res, "Failed to retrieve snapshots"); }
}

async function createWorkforceSnapshot(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { departmentId, snapshotDate, headcount } = req.body;
    if (!departmentId || !snapshotDate || headcount === undefined) {
      sendBadRequest(res, "Required: departmentId, snapshotDate, headcount"); return;
    }
    const snapshot = await workforceService.createWorkforceSnapshot({
      ...req.body,
      headcount: Number(headcount),
      avgSatisfaction: req.body.avgSatisfaction !== undefined ? Number(req.body.avgSatisfaction) : undefined,
      avgPerformance: req.body.avgPerformance !== undefined ? Number(req.body.avgPerformance) : undefined,
      turnoverRate: req.body.turnoverRate !== undefined ? Number(req.body.turnoverRate) : undefined,
      avgTenure: req.body.avgTenure !== undefined ? Number(req.body.avgTenure) : undefined,
      overtimeHours: req.body.overtimeHours !== undefined ? Number(req.body.overtimeHours) : undefined,
    });
    sendCreated(res, snapshot, "Snapshot created");
  } catch (error) { logger.error("Create snapshot error:", error); sendError(res, "Failed to create snapshot"); }
}

async function getSatisfactionTrends(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const months = req.query.months ? parseInt(req.query.months as string, 10) : 12;
    const trends = await workforceService.getSatisfactionTrends(months);
    sendSuccess(res, trends, "Satisfaction trends retrieved");
  } catch (error) { logger.error("Satisfaction trends error:", error); sendError(res, "Failed to retrieve trends"); }
}

async function getDepartmentComparison(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const comparison = await workforceService.getDepartmentComparison();
    sendSuccess(res, comparison, "Department comparison retrieved");
  } catch (error) { logger.error("Department comparison error:", error); sendError(res, "Failed to retrieve comparison"); }
}

async function getSurveys(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { status } = req.query;
    const result = await workforceService.getSurveys({ page, limit, skip, status: status as string });
    sendPaginated(res, result.surveys, result.total, page, limit, "Surveys retrieved");
  } catch (error) { logger.error("Get surveys error:", error); sendError(res, "Failed to retrieve surveys"); }
}

async function getSurveyById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const survey = await workforceService.getSurveyById(req.params.id);
    if (!survey) { sendNotFound(res, "Survey"); return; }
    sendSuccess(res, survey, "Survey retrieved");
  } catch (error) { logger.error("Get survey error:", error); sendError(res, "Failed to retrieve survey"); }
}

async function createSurvey(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { title, questions } = req.body;
    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      sendBadRequest(res, "Title and at least one question are required"); return;
    }
    const survey = await workforceService.createSurvey({ ...req.body, createdBy: req.user?.userId });
    sendCreated(res, survey, "Survey created");
  } catch (error) { logger.error("Create survey error:", error); sendError(res, "Failed to create survey"); }
}

async function updateSurveyStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (!status) { sendBadRequest(res, "Status is required"); return; }
    const survey = await workforceService.updateSurveyStatus(req.params.id, status);
    sendSuccess(res, survey, "Survey status updated");
  } catch (error) { logger.error("Update survey status error:", error); sendError(res, "Failed to update survey"); }
}

async function submitSurveyResponse(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { responses } = req.body;
    if (!responses || !Array.isArray(responses)) { sendBadRequest(res, "Responses array required"); return; }
    const results = await workforceService.submitSurveyResponse({
      responses, respondentId: req.user?.userId,
    });
    sendCreated(res, { count: results.length }, "Survey response submitted");
  } catch (error) { logger.error("Submit response error:", error); sendError(res, "Failed to submit response"); }
}

async function getSurveyResults(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const results = await workforceService.getSurveyResults(req.params.id);
    sendSuccess(res, results, "Survey results retrieved");
  } catch (error) {
    if (error instanceof WorkforceError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Survey results error:", error); sendError(res, "Failed to retrieve survey results");
  }
}

const workforceController = {
  getAttritionPredictions, getAttritionSummary,
  createAttritionPrediction, bulkCreateAttritionPredictions,
  getWorkforceSnapshots, createWorkforceSnapshot,
  getSatisfactionTrends, getDepartmentComparison,
  getSurveys, getSurveyById, createSurvey, updateSurveyStatus,
  submitSurveyResponse, getSurveyResults,
};

export default workforceController;
