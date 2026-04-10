import { Router } from "express";
import predictiveController from "../controllers/predictive";
import { authenticate } from "../middleware/auth";

const router = Router();

// ML Service health
router.get("/health", authenticate, predictiveController.getHealth);
router.get("/models", authenticate, predictiveController.getModels);

// Attrition
router.post("/attrition/train", authenticate, predictiveController.trainAttrition);
router.post("/attrition/predict", authenticate, predictiveController.predictAttrition);
router.post("/attrition/batch", authenticate, predictiveController.batchPredictAttrition);
router.get("/attrition/feature-importance", authenticate, predictiveController.getFeatureImportance);
router.get("/attrition/models/comparison", authenticate, predictiveController.getModelComparison);
router.get("/attrition/confusion-matrix", authenticate, predictiveController.getConfusionMatrix);
router.get("/attrition/roc-curve", authenticate, predictiveController.getRocCurve);
router.get("/attrition/department-risks", authenticate, predictiveController.getDepartmentRisks);
router.get("/attrition/training-history", authenticate, predictiveController.getTrainingHistory);

// Forecasting
router.post("/forecast", authenticate, predictiveController.forecast);
router.get("/forecast/sample/:metric", authenticate, predictiveController.getSampleData);
router.post("/forecast/budget-variance", authenticate, predictiveController.forecastBudgetVariance);
router.post("/forecast/project-timeline", authenticate, predictiveController.forecastProjectTimeline);

// Equipment
router.post("/equipment/train", authenticate, predictiveController.trainEquipment);
router.post("/equipment/predict", authenticate, predictiveController.predictEquipment);
router.post("/equipment/batch", authenticate, predictiveController.batchPredictEquipment);
router.get("/equipment/summary", authenticate, predictiveController.getEquipmentSummary);

// Anomaly
router.post("/anomaly/detect", authenticate, predictiveController.detectAnomalies);

export default router;
