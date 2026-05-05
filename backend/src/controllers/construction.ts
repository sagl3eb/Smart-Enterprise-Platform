import { Response } from "express";
import { ScopedRequest, readOrgFilter, writeOrgId } from "../middleware/callerScope";
import constructionService, { ConstructionError } from "../services/construction";
import {
  sendSuccess, sendCreated, sendPaginated, sendError,
  sendNotFound, sendBadRequest, parsePagination,
} from "../utils/response";
import logger from "../utils/logger";

// ─── PROJECTS ──────────────────────────────────────────────

async function getProjects(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { status, search } = req.query;
    const result = await constructionService.getProjects({
      page, limit, skip,
      status: status as string,
      search: search as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });
    sendPaginated(res, result.projects, result.total, page, limit, "Projects retrieved");
  } catch (error) { logger.error("Get projects error:", error); sendError(res, "Failed to retrieve projects"); }
}

async function getProjectById(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const project = await constructionService.getProjectById(req.params.id, orgFilter);
    if (!project) { sendNotFound(res, "Project"); return; }
    sendSuccess(res, project, "Project retrieved");
  } catch (error) { logger.error("Get project error:", error); sendError(res, "Failed to retrieve project"); }
}

async function createProject(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { name, code, startDate, organizationId: bodyOrgId } = req.body;
    if (!name || !code || !startDate) { sendBadRequest(res, "Name, code, and start date are required"); return; }
    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;
    const project = await constructionService.createProject({
      ...req.body,
      estimatedBudget: req.body.estimatedBudget !== undefined ? Number(req.body.estimatedBudget) : undefined,
      organizationId: orgId,
    });
    sendCreated(res, project, "Project created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create project error:", error); sendError(res, "Failed to create project");
  }
}

async function updateProject(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const project = await constructionService.updateProject(req.params.id, {
      ...req.body,
      estimatedBudget: req.body.estimatedBudget !== undefined ? Number(req.body.estimatedBudget) : undefined,
      actualBudget: req.body.actualBudget !== undefined ? Number(req.body.actualBudget) : undefined,
      progress: req.body.progress !== undefined ? Number(req.body.progress) : undefined,
    }, orgFilter);
    sendSuccess(res, project, "Project updated");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update project error:", error); sendError(res, "Failed to update project");
  }
}

async function deleteProject(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    await constructionService.deleteProject(req.params.id, orgFilter);
    sendSuccess(res, null, "Project cancelled");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete project error:", error); sendError(res, "Failed to cancel project");
  }
}

async function getProjectSummary(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const summary = await constructionService.getProjectSummary(orgFilter);
    sendSuccess(res, summary, "Project summary retrieved");
  } catch (error) { logger.error("Project summary error:", error); sendError(res, "Failed to retrieve project summary"); }
}

// ─── MILESTONES ────────────────────────────────────────────

async function getProjectMilestones(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const milestones = await constructionService.getProjectMilestones(req.params.projectId, orgFilter);
    sendSuccess(res, milestones, "Milestones retrieved");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Get milestones error:", error); sendError(res, "Failed to retrieve milestones");
  }
}

async function createMilestone(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { name, dueDate } = req.body;
    if (!name || !dueDate) { sendBadRequest(res, "Name and due date are required"); return; }
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const milestone = await constructionService.createMilestone({
      ...req.body,
      projectId: req.params.projectId,
      organizationId: orgFilter,
    });
    sendCreated(res, milestone, "Milestone created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create milestone error:", error); sendError(res, "Failed to create milestone");
  }
}

async function updateMilestone(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const milestone = await constructionService.updateMilestone(req.params.id, req.body, orgFilter);
    sendSuccess(res, milestone, "Milestone updated");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update milestone error:", error); sendError(res, "Failed to update milestone");
  }
}

async function deleteMilestone(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    await constructionService.deleteMilestone(req.params.id, orgFilter);
    sendSuccess(res, null, "Milestone deleted");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete milestone error:", error); sendError(res, "Failed to delete milestone");
  }
}

// ─── TASKS ─────────────────────────────────────────────────

async function getTasks(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { projectId, status, priority, assignedTo } = req.query;
    const result = await constructionService.getProjectTasks({
      page, limit, skip, projectId: projectId as string,
      status: status as string, priority: priority as string, assignedTo: assignedTo as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });
    sendPaginated(res, result.tasks, result.total, page, limit, "Tasks retrieved");
  } catch (error) { logger.error("Get tasks error:", error); sendError(res, "Failed to retrieve tasks"); }
}

async function createTask(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { projectId, title } = req.body;
    if (!projectId || !title) { sendBadRequest(res, "Project ID and title are required"); return; }
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const task = await constructionService.createTask({
      ...req.body,
      estimatedHours: req.body.estimatedHours !== undefined ? Number(req.body.estimatedHours) : undefined,
      organizationId: orgFilter,
    });
    sendCreated(res, task, "Task created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create task error:", error); sendError(res, "Failed to create task");
  }
}

async function updateTask(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const task = await constructionService.updateTask(req.params.id, {
      ...req.body,
      estimatedHours: req.body.estimatedHours !== undefined ? Number(req.body.estimatedHours) : undefined,
      actualHours: req.body.actualHours !== undefined ? Number(req.body.actualHours) : undefined,
    }, orgFilter);
    sendSuccess(res, task, "Task updated");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update task error:", error); sendError(res, "Failed to update task");
  }
}

async function deleteTask(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    await constructionService.deleteTask(req.params.id, orgFilter);
    sendSuccess(res, null, "Task deleted");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete task error:", error); sendError(res, "Failed to delete task");
  }
}

// ─── MATERIALS ─────────────────────────────────────────────

async function getMaterials(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { category, search } = req.query;
    const result = await constructionService.getMaterials({
      page, limit, skip,
      category: category as string,
      search: search as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });
    sendPaginated(res, result.materials, result.total, page, limit, "Materials retrieved");
  } catch (error) { logger.error("Get materials error:", error); sendError(res, "Failed to retrieve materials"); }
}

async function createMaterial(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { name, code, category, unit, unitPrice, organizationId: bodyOrgId } = req.body;
    if (!name || !code || !category || !unit || unitPrice === undefined) {
      sendBadRequest(res, "Required: name, code, category, unit, unitPrice"); return;
    }
    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;
    const material = await constructionService.createMaterial({
      ...req.body,
      unitPrice: Number(unitPrice),
      stockQty: req.body.stockQty !== undefined ? Number(req.body.stockQty) : undefined,
      reorderLevel: req.body.reorderLevel !== undefined ? Number(req.body.reorderLevel) : undefined,
      organizationId: orgId,
    });
    sendCreated(res, material, "Material created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create material error:", error); sendError(res, "Failed to create material");
  }
}

async function updateMaterial(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const material = await constructionService.updateMaterial(req.params.id, {
      ...req.body,
      unitPrice: req.body.unitPrice !== undefined ? Number(req.body.unitPrice) : undefined,
      stockQty: req.body.stockQty !== undefined ? Number(req.body.stockQty) : undefined,
      reorderLevel: req.body.reorderLevel !== undefined ? Number(req.body.reorderLevel) : undefined,
    }, orgFilter);
    sendSuccess(res, material, "Material updated");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update material error:", error); sendError(res, "Failed to update material");
  }
}

async function deleteMaterial(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    await constructionService.deleteMaterial(req.params.id, orgFilter);
    sendSuccess(res, null, "Material deleted");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete material error:", error); sendError(res, "Failed to delete material");
  }
}

async function getLowStockMaterials(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const materials = await constructionService.getLowStockMaterials(orgFilter);
    sendSuccess(res, materials, "Low stock materials retrieved");
  } catch (error) { logger.error("Low stock error:", error); sendError(res, "Failed to retrieve low stock materials"); }
}

// ─── MATERIAL REQUESTS ─────────────────────────────────────

async function getMaterialRequests(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { projectId, status } = req.query;
    const result = await constructionService.getMaterialRequests({
      page, limit, skip,
      projectId: projectId as string,
      status: status as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });
    sendPaginated(res, result.requests, result.total, page, limit, "Material requests retrieved");
  } catch (error) { logger.error("Get material requests error:", error); sendError(res, "Failed to retrieve material requests"); }
}

async function createMaterialRequest(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { projectId, materialId, quantity, requestedBy } = req.body;
    if (!projectId || !materialId || quantity === undefined || !requestedBy) {
      sendBadRequest(res, "Required: projectId, materialId, quantity, requestedBy"); return;
    }
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const request = await constructionService.createMaterialRequest({
      ...req.body,
      quantity: Number(quantity),
      organizationId: orgFilter,
      requesterUserId: req.scope?.userId,
      requesterRole: req.scope?.roleName,
    });
    sendCreated(res, request, "Material request created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create material request error:", error); sendError(res, "Failed to create material request");
  }
}

async function updateMaterialRequestStatus(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (!status) { sendBadRequest(res, "Status is required"); return; }
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const request = await constructionService.updateMaterialRequestStatus(req.params.id, status, req.user?.userId, orgFilter);
    sendSuccess(res, request, "Material request updated");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update material request error:", error); sendError(res, "Failed to update material request");
  }
}

// ─── EQUIPMENT ─────────────────────────────────────────────

async function getEquipmentFleet(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { type, status, search } = req.query;
    const result = await constructionService.getEquipmentFleet({
      page, limit, skip,
      type: type as string, status: status as string, search: search as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });
    sendPaginated(res, result.equipment, result.total, page, limit, "Equipment retrieved");
  } catch (error) { logger.error("Get equipment error:", error); sendError(res, "Failed to retrieve equipment"); }
}

async function createEquipment(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { name, type, organizationId: bodyOrgId } = req.body;
    if (!name || !type) { sendBadRequest(res, "Name and type are required"); return; }
    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;
    const equipment = await constructionService.createEquipment({
      ...req.body,
      hourlyRate: req.body.hourlyRate !== undefined ? Number(req.body.hourlyRate) : undefined,
      organizationId: orgId,
    });
    sendCreated(res, equipment, "Equipment created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create equipment error:", error); sendError(res, "Failed to create equipment");
  }
}

async function updateEquipment(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const equipment = await constructionService.updateEquipment(req.params.id, {
      ...req.body,
      hourlyRate: req.body.hourlyRate !== undefined ? Number(req.body.hourlyRate) : undefined,
    }, orgFilter);
    sendSuccess(res, equipment, "Equipment updated");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update equipment error:", error); sendError(res, "Failed to update equipment");
  }
}

async function deleteEquipment(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    await constructionService.deleteEquipment(req.params.id, orgFilter);
    sendSuccess(res, null, "Equipment deleted");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete equipment error:", error); sendError(res, "Failed to delete equipment");
  }
}

// ─── SITE REPORTS ──────────────────────────────────────────

async function getSiteReports(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { projectId, startDate, endDate } = req.query;
    const result = await constructionService.getSiteReports({
      page, limit, skip,
      projectId: projectId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });
    sendPaginated(res, result.reports, result.total, page, limit, "Site reports retrieved");
  } catch (error) { logger.error("Get site reports error:", error); sendError(res, "Failed to retrieve site reports"); }
}

async function createSiteReport(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { projectId, reportDate, summary } = req.body;
    if (!projectId || !reportDate || !summary) {
      sendBadRequest(res, "Required: projectId, reportDate, summary"); return;
    }
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const report = await constructionService.createSiteReport({
      ...req.body,
      createdBy: req.body.createdBy || req.user?.userId || "system",
      organizationId: orgFilter,
    });
    sendCreated(res, report, "Site report created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create site report error:", error); sendError(res, "Failed to create site report");
  }
}

// ─── SUPPLIERS ─────────────────────────────────────────────

async function getSuppliers(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const suppliers = await constructionService.getSuppliers(orgFilter);
    sendSuccess(res, suppliers, "Suppliers retrieved");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Get suppliers error:", error); sendError(res, "Failed to retrieve suppliers");
  }
}

async function createSupplier(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) { sendBadRequest(res, "Supplier name is required"); return; }
    const orgId = req.scope ? writeOrgId(req.scope, req.body.organizationId) : undefined;
    const supplier = await constructionService.createSupplier(req.body, orgId);
    sendCreated(res, supplier, "Supplier created");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create supplier error:", error); sendError(res, "Failed to create supplier");
  }
}

async function updateSupplier(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const supplier = await constructionService.updateSupplier(req.params.id, req.body, orgFilter);
    sendSuccess(res, supplier, "Supplier updated");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update supplier error:", error); sendError(res, "Failed to update supplier");
  }
}

async function deleteSupplier(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    await constructionService.deleteSupplier(req.params.id, orgFilter);
    sendSuccess(res, null, "Supplier deleted");
  } catch (error) {
    if (error instanceof ConstructionError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete supplier error:", error); sendError(res, "Failed to delete supplier");
  }
}

const constructionController = {
  getProjects, getProjectById, createProject, updateProject, deleteProject, getProjectSummary,
  getProjectMilestones, createMilestone, updateMilestone, deleteMilestone,
  getTasks, createTask, updateTask, deleteTask,
  getMaterials, createMaterial, updateMaterial, deleteMaterial, getLowStockMaterials,
  getMaterialRequests, createMaterialRequest, updateMaterialRequestStatus,
  getEquipmentFleet, createEquipment, updateEquipment, deleteEquipment,
  getSiteReports, createSiteReport,
  getSuppliers, createSupplier, updateSupplier, deleteSupplier,
};

export default constructionController;
