import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import predictiveService from "../services/predictive";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response";
import logger from "../utils/logger";

async function trainAttrition(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await predictiveService.trainAttrition();
    sendSuccess(res, result, "Attrition model trained");
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    sendError(res, err.message || "Training failed", err.statusCode || 500);
  }
}

async function predictAttrition(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await predictiveService.predictAttrition(req.body);
    sendSuccess(res, result, "Prediction complete");
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    sendError(res, err.message || "Prediction failed", err.statusCode || 500);
  }
}

async function batchPredictAttrition(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employees } = req.body;
    if (!employees || !Array.isArray(employees)) { sendBadRequest(res, "Employees array required"); return; }
    const result = await predictiveService.batchPredictAttrition(employees);
    sendSuccess(res, result, "Batch prediction complete");
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    sendError(res, err.message || "Batch prediction failed", err.statusCode || 500);
  }
}

async function getFeatureImportance(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await predictiveService.getFeatureImportance();
    sendSuccess(res, result, "Feature importance retrieved");
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    sendError(res, err.message || "Failed", err.statusCode || 500);
  }
}

async function forecast(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await predictiveService.forecast(req.body);
    sendSuccess(res, result, "Forecast generated");
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    sendError(res, err.message || "Forecast failed", err.statusCode || 500);
  }
}

async function getSampleData(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { metric } = req.params;
    const days = Number(req.query.days) || 365;
    const result = await predictiveService.getSampleData(metric, days);
    sendSuccess(res, result, "Sample data retrieved");
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    sendError(res, err.message || "Failed", err.statusCode || 500);
  }
}

async function detectAnomalies(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await predictiveService.detectAnomalies(req.body);
    sendSuccess(res, result, "Anomaly detection complete");
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    sendError(res, err.message || "Failed", err.statusCode || 500);
  }
}

async function getModels(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await predictiveService.getModels();
    sendSuccess(res, result, "Models retrieved");
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    sendError(res, err.message || "Failed", err.statusCode || 500);
  }
}

async function getHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await predictiveService.getHealth();
    sendSuccess(res, result, "ML service healthy");
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    sendError(res, err.message || "ML service unavailable", err.statusCode || 503);
  }
}

const predictiveController = {
  trainAttrition, predictAttrition, batchPredictAttrition, getFeatureImportance,
  forecast, getSampleData,
  detectAnomalies,
  getModels, getHealth,
};

export default predictiveController;
