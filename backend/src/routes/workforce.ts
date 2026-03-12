import { Router } from "express";
import workforceController from "../controllers/workforce";
import { authenticate } from "../middleware/auth";
import { requireMinRole } from "../middleware/rbac";

const router = Router();
router.use(authenticate);

// ─── Attrition ─────────────────────────────────────────────
router.get("/attrition", workforceController.getAttritionPredictions);
router.get("/attrition/summary", workforceController.getAttritionSummary);
router.post("/attrition", requireMinRole("manager"), workforceController.createAttritionPrediction);
router.post("/attrition/bulk", requireMinRole("manager"), workforceController.bulkCreateAttritionPredictions);

// ─── Snapshots ─────────────────────────────────────────────
router.get("/snapshots", workforceController.getWorkforceSnapshots);
router.post("/snapshots", requireMinRole("manager"), workforceController.createWorkforceSnapshot);

// ─── Trends & Comparison ───────────────────────────────────
router.get("/satisfaction-trends", workforceController.getSatisfactionTrends);
router.get("/department-comparison", workforceController.getDepartmentComparison);

// ─── Surveys ───────────────────────────────────────────────
router.get("/surveys", workforceController.getSurveys);
router.get("/surveys/:id", workforceController.getSurveyById);
router.get("/surveys/:id/results", requireMinRole("manager"), workforceController.getSurveyResults);
router.post("/surveys", requireMinRole("manager"), workforceController.createSurvey);
router.put("/surveys/:id/status", requireMinRole("manager"), workforceController.updateSurveyStatus);
router.post("/surveys/:id/respond", workforceController.submitSurveyResponse);

export default router;
