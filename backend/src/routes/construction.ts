import { Router } from "express";
import constructionController from "../controllers/construction";
import { authenticate } from "../middleware/auth";
import { attachScope } from "../middleware/callerScope";
import { blockViewerWrites, blockSuperAdminModuleWrites } from "../middleware/rbac";

const router = Router();
router.use(authenticate);
router.use(attachScope);
router.use(blockViewerWrites);
router.use(blockSuperAdminModuleWrites);

router.get("/projects/summary", constructionController.getProjectSummary);

router.get("/projects", constructionController.getProjects);
router.get("/projects/:id", constructionController.getProjectById);
router.post("/projects", constructionController.createProject);
router.put("/projects/:id", constructionController.updateProject);
router.delete("/projects/:id", constructionController.deleteProject);

router.get("/projects/:projectId/milestones", constructionController.getProjectMilestones);
router.post("/projects/:projectId/milestones", constructionController.createMilestone);
router.put("/milestones/:id", constructionController.updateMilestone);
router.delete("/milestones/:id", constructionController.deleteMilestone);

router.get("/tasks", constructionController.getTasks);
router.post("/tasks", constructionController.createTask);
router.put("/tasks/:id", constructionController.updateTask);
router.delete("/tasks/:id", constructionController.deleteTask);

router.get("/materials", constructionController.getMaterials);
router.get("/materials/low-stock", constructionController.getLowStockMaterials);
router.post("/materials", constructionController.createMaterial);
router.put("/materials/:id", constructionController.updateMaterial);
router.delete("/materials/:id", constructionController.deleteMaterial);

router.get("/material-requests", constructionController.getMaterialRequests);
router.post("/material-requests", constructionController.createMaterialRequest);
router.put("/material-requests/:id/status", constructionController.updateMaterialRequestStatus);

router.get("/equipment", constructionController.getEquipmentFleet);
router.post("/equipment", constructionController.createEquipment);
router.put("/equipment/:id", constructionController.updateEquipment);
router.delete("/equipment/:id", constructionController.deleteEquipment);

router.get("/site-reports", constructionController.getSiteReports);
router.post("/site-reports", constructionController.createSiteReport);

router.get("/suppliers", constructionController.getSuppliers);
router.post("/suppliers", constructionController.createSupplier);
router.put("/suppliers/:id", constructionController.updateSupplier);
router.delete("/suppliers/:id", constructionController.deleteSupplier);

export default router;
