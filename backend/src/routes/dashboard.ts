import { Router } from "express";
import dashboardController from "../controllers/dashboard";
import { authenticate } from "../middleware/auth";
import { requireMinRole } from "../middleware/rbac";

const router = Router();
router.use(authenticate);

// ─── Executive Summary ─────────────────────────────────────
router.get("/summary", dashboardController.getExecutiveSummary);

// ─── KPIs ──────────────────────────────────────────────────
router.get("/kpis", dashboardController.getKpiDefinitions);
router.get("/kpis/latest", dashboardController.getLatestKpis);
router.get("/kpis/:id/history", dashboardController.getKpiHistory);
router.post("/kpis", requireMinRole("manager"), dashboardController.createKpiDefinition);
router.put("/kpis/:id", requireMinRole("manager"), dashboardController.updateKpiDefinition);
router.post("/kpis/snapshot", requireMinRole("manager"), dashboardController.recordKpiSnapshot);

// ─── Layouts ───────────────────────────────────────────────
router.get("/layouts", dashboardController.getDashboardLayouts);
router.get("/layouts/:id", dashboardController.getDashboardLayoutById);
router.post("/layouts", dashboardController.createDashboardLayout);
router.put("/layouts/:id", dashboardController.updateDashboardLayout);
router.delete("/layouts/:id", dashboardController.deleteDashboardLayout);

// ─── Widgets ───────────────────────────────────────────────
router.post("/widgets", dashboardController.addWidget);
router.put("/widgets/:id", dashboardController.updateWidget);
router.delete("/widgets/:id", dashboardController.deleteWidget);

export default router;
