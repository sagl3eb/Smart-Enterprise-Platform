import { Router } from "express";
import workforceController from "../controllers/workforce";
import { authenticate } from "../middleware/auth";
import { attachScope } from "../middleware/callerScope";
import { blockViewerWrites, blockSuperAdminModuleWrites } from "../middleware/rbac";

const router = Router();
router.use(authenticate);
router.use(attachScope);
router.use(blockViewerWrites);
router.use(blockSuperAdminModuleWrites);

router.get("/attrition", workforceController.getAttritionPredictions);
router.get("/attrition/summary", workforceController.getAttritionSummary);
router.post("/attrition", workforceController.createAttritionPrediction);
router.post("/attrition/bulk", workforceController.bulkCreateAttritionPredictions);

router.get("/snapshots", workforceController.getWorkforceSnapshots);
router.post("/snapshots", workforceController.createWorkforceSnapshot);

router.get("/satisfaction-trends", workforceController.getSatisfactionTrends);
router.get("/department-comparison", workforceController.getDepartmentComparison);

router.get("/surveys", workforceController.getSurveys);
router.get("/surveys/:id", workforceController.getSurveyById);
router.get("/surveys/:id/results", workforceController.getSurveyResults);
router.post("/surveys", workforceController.createSurvey);
router.put("/surveys/:id/status", workforceController.updateSurveyStatus);
router.post("/surveys/:id/respond", workforceController.submitSurveyResponse);

export default router;
