import { Router } from "express";
import constructionController from "../controllers/construction";
import { authenticate } from "../middleware/auth";
import { requireRole, requireMinRole } from "../middleware/rbac";

const router = Router();
router.use(authenticate);

// ─── Summary ───────────────────────────────────────────────
router.get("/projects/summary", constructionController.getProjectSummary);

// ─── Projects ──────────────────────────────────────────────
router.get("/projects", constructionController.getProjects);
router.get("/projects/:id", constructionController.getProjectById);
router.post("/projects", requireMinRole("manager"), constructionController.createProject);
router.put("/projects/:id", requireMinRole("manager"), constructionController.updateProject);
router.delete("/projects/:id", requireRole("admin"), constructionController.deleteProject);

// ─── Milestones ────────────────────────────────────────────
router.get("/projects/:projectId/milestones", constructionController.getProjectMilestones);
router.post("/projects/:projectId/milestones", requireMinRole("manager"), constructionController.createMilestone);
router.put("/milestones/:id", requireMinRole("manager"), constructionController.updateMilestone);
router.delete("/milestones/:id", requireRole("admin"), constructionController.deleteMilestone);

// ─── Tasks ─────────────────────────────────────────────────
router.get("/tasks", constructionController.getTasks);
router.post("/tasks", requireMinRole("employee"), constructionController.createTask);
router.put("/tasks/:id", requireMinRole("employee"), constructionController.updateTask);
router.delete("/tasks/:id", requireMinRole("manager"), constructionController.deleteTask);

// ─── Materials ─────────────────────────────────────────────
router.get("/materials", constructionController.getMaterials);
router.get("/materials/low-stock", constructionController.getLowStockMaterials);
router.post("/materials", requireMinRole("manager"), constructionController.createMaterial);
router.put("/materials/:id", requireMinRole("manager"), constructionController.updateMaterial);

// ─── Material Requests ─────────────────────────────────────
router.get("/material-requests", constructionController.getMaterialRequests);
router.post("/material-requests", requireMinRole("employee"), constructionController.createMaterialRequest);
router.put("/material-requests/:id/status", requireMinRole("manager"), constructionController.updateMaterialRequestStatus);

// ─── Equipment Fleet ───────────────────────────────────────
router.get("/equipment", constructionController.getEquipmentFleet);
router.post("/equipment", requireMinRole("manager"), constructionController.createEquipment);
router.put("/equipment/:id", requireMinRole("manager"), constructionController.updateEquipment);
router.delete("/equipment/:id", requireRole("admin"), constructionController.deleteEquipment);

// ─── Site Reports ──────────────────────────────────────────
router.get("/site-reports", constructionController.getSiteReports);
router.post("/site-reports", requireMinRole("employee"), constructionController.createSiteReport);

export default router;
