import { Router } from "express";
import alertController from "../controllers/alerts";
import { authenticate } from "../middleware/auth";
import { requireRole, requireMinRole } from "../middleware/rbac";

const router = Router();
router.use(authenticate);

// ─── Stats ─────────────────────────────────────────────────
router.get("/stats", alertController.getAlertStats);

// ─── Alert Rules ───────────────────────────────────────────
router.get("/rules", alertController.getAlertRules);
router.get("/rules/:id", alertController.getAlertRuleById);
router.post("/rules", requireMinRole("manager"), alertController.createAlertRule);
router.put("/rules/:id", requireMinRole("manager"), alertController.updateAlertRule);
router.delete("/rules/:id", requireRole("admin"), alertController.deleteAlertRule);

// ─── Evaluate (manual trigger) ─────────────────────────────
router.post("/evaluate", requireMinRole("manager"), alertController.evaluateAlertRules);

// ─── Alerts Feed ───────────────────────────────────────────
router.get("/", alertController.getAlerts);
router.get("/:id", alertController.getAlertById);
router.post("/", requireMinRole("manager"), alertController.createAlert);
router.put("/:id/read", alertController.markAlertRead);
router.put("/read-all", alertController.markAllAlertsRead);
router.put("/:id/resolve", requireMinRole("manager"), alertController.resolveAlert);
router.delete("/:id", requireRole("admin"), alertController.deleteAlert);

// ─── Optimization Suggestions ──────────────────────────────
router.get("/suggestions", alertController.getOptimizationSuggestions);
router.post("/suggestions", requireMinRole("manager"), alertController.createOptimizationSuggestion);
router.put("/suggestions/:id/status", requireMinRole("manager"), alertController.updateOptimizationSuggestionStatus);

export default router;
