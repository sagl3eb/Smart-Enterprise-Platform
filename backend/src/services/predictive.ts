import axios from "axios";
import logger from "../utils/logger";

const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

async function proxyToML(method: string, path: string, data?: unknown, timeoutMs?: number) {
  // Training endpoints can take several minutes on large datasets
  const isTraining = path.includes("/train");
  const timeout = timeoutMs ?? (isTraining ? 600000 : 60000);
  try {
    const res = await axios({
      method,
      url: `${ML_URL}${path}`,
      data,
      timeout,
    });
    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      logger.error(`ML service error: ${error.response.status} ${JSON.stringify(error.response.data)}`);
      throw { statusCode: error.response.status, message: error.response.data?.detail || "ML service error" };
    }
    logger.error("ML service unreachable:", error);
    throw { statusCode: 503, message: "ML service is not available. Make sure it's running on port 8000." };
  }
}

// ─── Attrition ─────────────────────────────────────────────

async function trainAttrition() {
  return proxyToML("POST", "/predict/attrition/train");
}

async function predictAttrition(data: {
  satisfaction_score: number;
  performance_score: number;
  years_at_company: number;
  overtime_hours_avg: number;
  num_projects: number;
  salary: number;
  days_since_last_promotion: number;
}) {
  return proxyToML("POST", "/predict/attrition/predict", data);
}

async function batchPredictAttrition(employees: Array<Record<string, number>>) {
  return proxyToML("POST", "/predict/attrition/batch", { employees });
}

async function getFeatureImportance() {
  return proxyToML("GET", "/predict/attrition/feature-importance");
}

async function getModelComparison() {
  return proxyToML("GET", "/predict/attrition/models/comparison");
}

async function getConfusionMatrix() {
  return proxyToML("GET", "/predict/attrition/confusion-matrix");
}

async function getRocCurve() {
  return proxyToML("GET", "/predict/attrition/roc-curve");
}

async function getDepartmentRisks() {
  return proxyToML("GET", "/predict/attrition/department-risks");
}

async function getTrainingHistory() {
  return proxyToML("GET", "/predict/attrition/training-history");
}

// ─── Forecasting ───────────────────────────────────────────

async function forecast(data: {
  metric: string;
  historical_data: Array<{ date: string; value: number }>;
  forecast_days?: number;
}) {
  return proxyToML("POST", "/predict/forecast", data);
}

async function getSampleData(metric: string, days: number = 365) {
  return proxyToML("GET", `/predict/forecast/sample/${metric}?days=${days}`);
}

// ─── Anomaly ───────────────────────────────────────────────

async function detectAnomalies(data: {
  metric: string;
  data: Array<{ timestamp: string; value: number }>;
  contamination?: number;
}) {
  return proxyToML("POST", "/predict/anomaly/detect", data);
}

// ─── Equipment ────────────────────────────────────────────

async function trainEquipment() {
  return proxyToML("POST", "/predict/equipment/train");
}

async function predictEquipment(data: Record<string, unknown>) {
  return proxyToML("POST", "/predict/equipment/predict", data);
}

async function batchPredictEquipment(assets: Array<Record<string, unknown>>) {
  return proxyToML("POST", "/predict/equipment/batch", { assets });
}

async function getEquipmentSummary() {
  return proxyToML("GET", "/predict/equipment/summary");
}

// ─── Forecasting — Budget Variance & Project Timeline ─────

async function forecastBudgetVariance(data: unknown) {
  return proxyToML("POST", "/predict/forecast/budget-variance", data);
}

async function forecastProjectTimeline(data: unknown) {
  return proxyToML("POST", "/predict/forecast/project-timeline", data);
}

// ─── Models & Health ───────────────────────────────────────

async function getModels() {
  return proxyToML("GET", "/models");
}

async function getHealth() {
  return proxyToML("GET", "/health");
}

const predictiveService = {
  trainAttrition, predictAttrition, batchPredictAttrition, getFeatureImportance,
  getModelComparison, getConfusionMatrix, getRocCurve, getDepartmentRisks, getTrainingHistory,
  forecast, getSampleData,
  detectAnomalies,
  trainEquipment, predictEquipment, batchPredictEquipment, getEquipmentSummary,
  forecastBudgetVariance, forecastProjectTimeline,
  getModels, getHealth,
};

export default predictiveService;
