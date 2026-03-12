import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import constructionService, { ConstructionError } from "../services/construction";
import {
  sendSuccess, sendCreated, sendPaginated, sendError,
  sendNotFound, sendBadRequest, parsePagination,
} from "../utils/response";
import logger from "../utils/logger";

// ─── PROJECTS ──────────────────────────────────────────────

async function getProjects(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { status, search } = req.query;
    const result = await constructionService.getProjects({ page, limit, skip, status: status as string, search: search as string });
    sendPaginated(res, result.projects, result.total, page, limit, "Projects retrieved");
  } catch (error) { logger.error("Get projects error:", error); sendError(res, "Failed to retrieve projects"); }
}

async function getProjectById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const project = await constructionService.getProjectById(req.params.id);
    if (!project) { sendNotFound(res, "Project"); return; }
    sendSuccess(res, project, "Project retrieved");
  } catch (error) { logger.error("Get project error:", error); sendError(res, "Failed to retrieve project"); }
}

async function createProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, code, startDate } = req.body;
    if (!name || !code || !startDate) { sendBadRequest(res, "Name, code, and start date are required"); return; }
    const project = await constructionService.createProject({
      ...req.body,
      estimatedBudget: req.body.estimatedBudget !== undefined ? Number(req.body.estimatedBudget) : undefined,
    });
    sendCreated(res, project, "Project created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create project error:", error); sendError(res, "Failed to create project");
  }
}

async function updateProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const project = await constructionService.updateProject(req.params.id, {
      ...req.body,
      estimatedBudget: req.body.estimatedBudget !== undefined ? Number(req.body.estimatedBudget) : undefined,
      actualBudget: req.body.actualBudget !== undefined ? Number(req.body.actualBudget) : undefined,
      progress: req.body.progress !== undefined ? Number(req.body.progress) : undefined,
    });
    sendSuccess(res, project, "Project updated");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update project error:", error); sendError(res, "Failed to update project");
  }
}

async function deleteProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await constructionService.deleteProject(req.params.id);
    sendSuccess(res, null, "Project cancelled");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete project error:", error); sendError(res, "Failed to cancel project");
  }
}

async function getProjectSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const summary = await constructionService.getProjectSummary();
    sendSuccess(res, summary, "Project summary retrieved");
  } catch (error) { logger.error("Project summary error:", error); sendError(res, "Failed to retrieve project summary"); }
}

// ─── MILESTONES ────────────────────────────────────────────

async function getProjectMilestones(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const milestones = await constructionService.getProjectMilestones(req.params.projectId);
    sendSuccess(res, milestones, "Milestones retrieved");
  } catch (error) { logger.error("Get milestones error:", error); sendError(res, "Failed to retrieve milestones"); }
}

async function createMilestone(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, dueDate } = req.body;
    if (!name || !dueDate) { sendBadRequest(res, "Name and due date are required"); return; }
    const milestone = await constructionService.createMilestone({ ...req.body, projectId: req.params.projectId });
    sendCreated(res, milestone, "Milestone created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create milestone error:", error); sendError(res, "Failed to create milestone");
  }
}

async function updateMilestone(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const milestone = await constructionService.updateMilestone(req.params.id, req.body);
    sendSuccess(res, milestone, "Milestone updated");
  } catch (error) { logger.error("Update milestone error:", error); sendError(res, "Failed to update milestone"); }
}

async function deleteMilestone(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await constructionService.deleteMilestone(req.params.id);
    sendSuccess(res, null, "Milestone deleted");
  } catch (error) { logger.error("Delete milestone error:", error); sendError(res, "Failed to delete milestone"); }
}

// ─── TASKS ─────────────────────────────────────────────────

async function getTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { projectId, status, priority, assignedTo } = req.query;
    const result = await constructionService.getProjectTasks({
      page, limit, skip, projectId: projectId as string,
      status: status as string, priority: priority as string, assignedTo: assignedTo as string,
    });
    sendPaginated(res, result.tasks, result.total, page, limit, "Tasks retrieved");
  } catch (error) { logger.error("Get tasks error:", error); sendError(res, "Failed to retrieve tasks"); }
}

async function createTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { projectId, title } = req.body;
    if (!projectId || !title) { sendBadRequest(res, "Project ID and title are required"); return; }
    const task = await constructionService.createTask({
      ...req.body,
      estimatedHours: req.body.estimatedHours !== undefined ? Number(req.body.estimatedHours) : undefined,
    });
    sendCreated(res, task, "Task created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create task error:", error); sendError(res, "Failed to create task");
  }
}

async function updateTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const task = await constructionService.updateTask(req.params.id, {
      ...req.body,
      estimatedHours: req.body.estimatedHours !== undefined ? Number(req.body.estimatedHours) : undefined,
      actualHours: req.body.actualHours !== undefined ? Number(req.body.actualHours) : undefined,
    });
    sendSuccess(res, task, "Task updated");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update task error:", error); sendError(res, "Failed to update task");
  }
}

async function deleteTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await constructionService.deleteTask(req.params.id);
    sendSuccess(res, null, "Task deleted");
  } catch (error) { logger.error("Delete task error:", error); sendError(res, "Failed to delete task"); }
}

// ─── MATERIALS ─────────────────────────────────────────────

async function getMaterials(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { category, search } = req.query;
    const result = await constructionService.getMaterials({ page, limit, skip, category: category as string, search: search as string });
    sendPaginated(res, result.materials, result.total, page, limit, "Materials retrieved");
  } catch (error) { logger.error("Get materials error:", error); sendError(res, "Failed to retrieve materials"); }
}

async function createMaterial(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, code, category, unit, unitPrice } = req.body;
    if (!name || !code || !category || !unit || unitPrice === undefined) {
      sendBadRequest(res, "Required: name, code, category, unit, unitPrice"); return;
    }
    const material = await constructionService.createMaterial({
      ...req.body,
      unitPrice: Number(unitPrice),
      stockQty: req.body.stockQty !== undefined ? Number(req.body.stockQty) : undefined,
      reorderLevel: req.body.reorderLevel !== undefined ? Number(req.body.reorderLevel) : undefined,
    });
    sendCreated(res, material, "Material created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create material error:", error); sendError(res, "Failed to create material");
  }
}

async function updateMaterial(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const material = await constructionService.updateMaterial(req.params.id, {
      ...req.body,
      unitPrice: req.body.unitPrice !== undefined ? Number(req.body.unitPrice) : undefined,
      stockQty: req.body.stockQty !== undefined ? Number(req.body.stockQty) : undefined,
      reorderLevel: req.body.reorderLevel !== undefined ? Number(req.body.reorderLevel) : undefined,
    });
    sendSuccess(res, material, "Material updated");
  } catch (error) { logger.error("Update material error:", error); sendError(res, "Failed to update material"); }
}

async function getLowStockMaterials(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const materials = await constructionService.getLowStockMaterials();
    sendSuccess(res, materials, "Low stock materials retrieved");
  } catch (error) { logger.error("Low stock error:", error); sendError(res, "Failed to retrieve low stock materials"); }
}

// ─── MATERIAL REQUESTS ─────────────────────────────────────

async function getMaterialRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { projectId, status } = req.query;
    const result = await constructionService.getMaterialRequests({ page, limit, skip, projectId: projectId as string, status: status as string });
    sendPaginated(res, result.requests, result.total, page, limit, "Material requests retrieved");
  } catch (error) { logger.error("Get material requests error:", error); sendError(res, "Failed to retrieve material requests"); }
}

async function createMaterialRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { projectId, materialId, quantity, requestedBy } = req.body;
    if (!projectId || !materialId || quantity === undefined || !requestedBy) {
      sendBadRequest(res, "Required: projectId, materialId, quantity, requestedBy"); return;
    }
    const request = await constructionService.createMaterialRequest({ ...req.body, quantity: Number(quantity) });
    sendCreated(res, request, "Material request created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create material request error:", error); sendError(res, "Failed to create material request");
  }
}

async function updateMaterialRequestStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (!status) { sendBadRequest(res, "Status is required"); return; }
    const request = await constructionService.updateMaterialRequestStatus(req.params.id, status, req.user?.userId);
    sendSuccess(res, request, "Material request updated");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update material request error:", error); sendError(res, "Failed to update material request");
  }
}

// ─── EQUIPMENT ─────────────────────────────────────────────

async function getEquipmentFleet(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { type, status, search } = req.query;
    const result = await constructionService.getEquipmentFleet({
      page, limit, skip, type: type as string, status: status as string, search: search as string,
    });
    sendPaginated(res, result.equipment, result.total, page, limit, "Equipment retrieved");
  } catch (error) { logger.error("Get equipment error:", error); sendError(res, "Failed to retrieve equipment"); }
}

async function createEquipment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, type } = req.body;
    if (!name || !type) { sendBadRequest(res, "Name and type are required"); return; }
    const equipment = await constructionService.createEquipment({
      ...req.body,
      hourlyRate: req.body.hourlyRate !== undefined ? Number(req.body.hourlyRate) : undefined,
    });
    sendCreated(res, equipment, "Equipment created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create equipment error:", error); sendError(res, "Failed to create equipment");
  }
}

async function updateEquipment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const equipment = await constructionService.updateEquipment(req.params.id, {
      ...req.body,
      hourlyRate: req.body.hourlyRate !== undefined ? Number(req.body.hourlyRate) : undefined,
    });
    sendSuccess(res, equipment, "Equipment updated");
  } catch (error) { logger.error("Update equipment error:", error); sendError(res, "Failed to update equipment"); }
}

async function deleteEquipment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await constructionService.deleteEquipment(req.params.id);
    sendSuccess(res, null, "Equipment deleted");
  } catch (error) { logger.error("Delete equipment error:", error); sendError(res, "Failed to delete equipment"); }
}

// ─── SITE REPORTS ──────────────────────────────────────────

async function getSiteReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { projectId, startDate, endDate } = req.query;
    const result = await constructionService.getSiteReports({
      page, limit, skip, projectId: projectId as string, startDate: startDate as string, endDate: endDate as string,
    });
    sendPaginated(res, result.reports, result.total, page, limit, "Site reports retrieved");
  } catch (error) { logger.error("Get site reports error:", error); sendError(res, "Failed to retrieve site reports"); }
}

async function createSiteReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { projectId, reportDate, summary } = req.body;
    if (!projectId || !reportDate || !summary) {
      sendBadRequest(res, "Required: projectId, reportDate, summary"); return;
    }
    const report = await constructionService.createSiteReport({
      ...req.body,
      createdBy: req.body.createdBy || req.user?.userId || "system",
    });
    sendCreated(res, report, "Site report created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create site report error:", error); sendError(res, "Failed to create site report");
  }
}

const constructionController = {
  getProjects, getProjectById, createProject, updateProject, deleteProject, getProjectSummary,
  getProjectMilestones, createMilestone, updateMilestone, deleteMilestone,
  getTasks, createTask, updateTask, deleteTask,
  getMaterials, createMaterial, updateMaterial, getLowStockMaterials,
  getMaterialRequests, createMaterialRequest, updateMaterialRequestStatus,
  getEquipmentFleet, createEquipment, updateEquipment, deleteEquipment,
  getSiteReports, createSiteReport,
};

export default constructionController;
