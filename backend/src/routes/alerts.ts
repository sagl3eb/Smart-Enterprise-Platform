import { Router } from "express";
import alertController from "../controllers/alerts";
import { authenticate } from "../middleware/auth";
import { attachScope } from "../middleware/callerScope";
import { blockViewerWrites, blockSuperAdminModuleWrites } from "../middleware/rbac";

const router = Router();
router.use(authenticate);
router.use(attachScope);
router.use(blockViewerWrites);
router.use(blockSuperAdminModuleWrites);

router.get("/stats", alertController.getAlertStats);

router.get("/rules", alertController.getAlertRules);
router.get("/rules/:id", alertController.getAlertRuleById);
router.post("/rules", alertController.createAlertRule);
router.put("/rules/:id", alertController.updateAlertRule);
router.delete("/rules/:id", alertController.deleteAlertRule);

router.post("/evaluate", alertController.evaluateAlertRules);

router.get("/", alertController.getAlerts);
router.get("/:id", alertController.getAlertById);
router.post("/", alertController.createAlert);
router.put("/:id/read", alertController.markAlertRead);
router.put("/read-all", alertController.markAllAlertsRead);
router.put("/:id/resolve", alertController.resolveAlert);
router.delete("/:id", alertController.deleteAlert);

router.get("/suggestions", alertController.getOptimizationSuggestions);
router.post("/suggestions", alertController.createOptimizationSuggestion);
router.post("/suggestions/generate", alertController.generateOptimizationSuggestions);
router.put("/suggestions/:id/status", alertController.updateOptimizationSuggestionStatus);

export default router;
