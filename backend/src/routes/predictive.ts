import { Router } from "express";
import predictiveController from "../controllers/predictive";
import { authenticate } from "../middleware/auth";
import { attachScope } from "../middleware/callerScope";
import { blockViewerWrites, blockSuperAdminModuleWrites } from "../middleware/rbac";

const router = Router();
router.use(authenticate);
router.use(attachScope);
router.use(blockViewerWrites);
router.use(blockSuperAdminModuleWrites);

// ML Service health
router.get("/health", predictiveController.getHealth);
router.get("/models", predictiveController.getModels);

// Attrition
router.post("/attrition/train", predictiveController.trainAttrition);
router.post("/attrition/predict", predictiveController.predictAttrition);
router.post("/attrition/batch", predictiveController.batchPredictAttrition);
router.get("/attrition/feature-importance", predictiveController.getFeatureImportance);
router.get("/attrition/models/comparison", predictiveController.getModelComparison);
router.get("/attrition/confusion-matrix", predictiveController.getConfusionMatrix);
router.get("/attrition/roc-curve", predictiveController.getRocCurve);
router.get("/attrition/department-risks", predictiveController.getDepartmentRisks);
router.get("/attrition/training-history", predictiveController.getTrainingHistory);

// Forecasting
router.post("/forecast", predictiveController.forecast);
router.get("/forecast/sample/:metric", predictiveController.getSampleData);
router.post("/forecast/budget-variance", predictiveController.forecastBudgetVariance);
router.post("/forecast/project-timeline", predictiveController.forecastProjectTimeline);

// Equipment
router.post("/equipment/train", predictiveController.trainEquipment);
router.post("/equipment/predict", predictiveController.predictEquipment);
router.post("/equipment/batch", predictiveController.batchPredictEquipment);
router.get("/equipment/summary", predictiveController.getEquipmentSummary);

// Anomaly
router.post("/anomaly/detect", predictiveController.detectAnomalies);

export default router;
