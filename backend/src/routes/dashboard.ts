import { Router } from "express";
import dashboardController from "../controllers/dashboard";
import { authenticate } from "../middleware/auth";
import { attachScope } from "../middleware/callerScope";
import { blockViewerWrites } from "../middleware/rbac";

const router = Router();
router.use(authenticate);
router.use(attachScope);
router.use(blockViewerWrites);

router.get("/summary", dashboardController.getExecutiveSummary);
router.get("/charts", dashboardController.getDashboardCharts);

router.get("/kpis", dashboardController.getKpiDefinitions);
router.get("/kpis/latest", dashboardController.getLatestKpis);
router.get("/kpis/:id/history", dashboardController.getKpiHistory);
router.post("/kpis", dashboardController.createKpiDefinition);
router.put("/kpis/:id", dashboardController.updateKpiDefinition);
router.post("/kpis/snapshot", dashboardController.recordKpiSnapshot);

router.get("/layouts", dashboardController.getDashboardLayouts);
router.get("/layouts/:id", dashboardController.getDashboardLayoutById);
router.post("/layouts", dashboardController.createDashboardLayout);
router.put("/layouts/:id", dashboardController.updateDashboardLayout);
router.delete("/layouts/:id", dashboardController.deleteDashboardLayout);

router.post("/widgets", dashboardController.addWidget);
router.put("/widgets/:id", dashboardController.updateWidget);
router.delete("/widgets/:id", dashboardController.deleteWidget);

export default router;
