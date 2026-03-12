import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";

// ─── PROJECTS ──────────────────────────────────────────────

async function getProjects(filters: {
  page: number;
  limit: number;
  skip: number;
  status?: string;
  search?: string;
}) {
  const where: Prisma.ProjectWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { code: { contains: filters.search, mode: "insensitive" } },
      { clientName: { contains: filters.search, mode: "insensitive" } },
      { location: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        _count: { select: { milestones: true, tasks: true, siteReports: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.project.count({ where }),
  ]);

  return { projects, total };
}

async function getProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      milestones: { orderBy: { sortOrder: "asc" } },
      tasks: {
        orderBy: { createdAt: "desc" },
        include: { subtasks: { select: { id: true, title: true, status: true } } },
      },
      materialRequests: {
        include: { material: { select: { id: true, name: true, unit: true } } },
        orderBy: { createdAt: "desc" },
      },
      siteReports: { orderBy: { reportDate: "desc" }, take: 10 },
      _count: { select: { milestones: true, tasks: true, siteReports: true, materialRequests: true } },
    },
  });
}

async function createProject(data: {
  name: string;
  code: string;
  description?: string;
  clientName?: string;
  startDate: string;
  endDate?: string;
  estimatedBudget?: number;
  managerId?: string;
  location?: string;
}) {
  const existing = await prisma.project.findUnique({ where: { code: data.code } });
  if (existing) throw new ConstructionError("Project code already exists", 409);

  const project = await prisma.project.create({
    data: {
      name: data.name.trim(),
      code: data.code.toUpperCase().trim(),
      description: data.description?.trim(),
      clientName: data.clientName?.trim(),
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      estimatedBudget: data.estimatedBudget !== undefined ? new Prisma.Decimal(data.estimatedBudget) : undefined,
      managerId: data.managerId,
      location: data.location?.trim(),
    },
    include: { _count: { select: { milestones: true, tasks: true } } },
  });

  logger.info(`Project created: ${project.code} - ${project.name}`);
  return project;
}

async function updateProject(id: string, data: {
  name?: string;
  description?: string;
  clientName?: string;
  endDate?: string;
  estimatedBudget?: number;
  actualBudget?: number;
  status?: string;
  progress?: number;
  managerId?: string;
  location?: string;
}) {
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) throw new ConstructionError("Project not found", 404);

  return prisma.project.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() }),
      ...(data.clientName !== undefined && { clientName: data.clientName?.trim() }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
      ...(data.estimatedBudget !== undefined && { estimatedBudget: new Prisma.Decimal(data.estimatedBudget) }),
      ...(data.actualBudget !== undefined && { actualBudget: new Prisma.Decimal(data.actualBudget) }),
      ...(data.status && { status: data.status }),
      ...(data.progress !== undefined && { progress: new Prisma.Decimal(data.progress) }),
      ...(data.managerId !== undefined && { managerId: data.managerId }),
      ...(data.location !== undefined && { location: data.location?.trim() }),
    },
    include: { _count: { select: { milestones: true, tasks: true } } },
  });
}

async function deleteProject(id: string) {
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) throw new ConstructionError("Project not found", 404);
  await prisma.project.update({ where: { id }, data: { status: "cancelled" } });
  logger.info(`Project cancelled: ${existing.code}`);
}

async function getProjectSummary() {
  const [total, byStatus, totalBudget] = await Promise.all([
    prisma.project.count(),
    prisma.project.groupBy({ by: ["status"], _count: true }),
    prisma.project.aggregate({
      _sum: { estimatedBudget: true, actualBudget: true },
      _avg: { progress: true },
    }),
  ]);

  return {
    total,
    avgProgress: Math.round(Number(totalBudget._avg.progress || 0) * 100) / 100,
    totalEstimatedBudget: Number(totalBudget._sum.estimatedBudget || 0),
    totalActualBudget: Number(totalBudget._sum.actualBudget || 0),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
  };
}

// ─── MILESTONES ────────────────────────────────────────────

async function getProjectMilestones(projectId: string) {
  return prisma.projectMilestone.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
  });
}

async function createMilestone(data: {
  projectId: string;
  name: string;
  description?: string;
  dueDate: string;
  sortOrder?: number;
}) {
  const project = await prisma.project.findUnique({ where: { id: data.projectId } });
  if (!project) throw new ConstructionError("Project not found", 404);

  return prisma.projectMilestone.create({
    data: {
      projectId: data.projectId,
      name: data.name.trim(),
      description: data.description?.trim(),
      dueDate: new Date(data.dueDate),
      sortOrder: data.sortOrder || 0,
    },
  });
}

async function updateMilestone(id: string, data: {
  name?: string;
  description?: string;
  dueDate?: string;
  status?: string;
  sortOrder?: number;
}) {
  const updateData: Prisma.ProjectMilestoneUpdateInput = {};
  if (data.name) updateData.name = data.name.trim();
  if (data.description !== undefined) updateData.description = data.description?.trim();
  if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
  if (data.status) {
    updateData.status = data.status;
    if (data.status === "completed") updateData.completedAt = new Date();
  }
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  return prisma.projectMilestone.update({ where: { id }, data: updateData });
}

async function deleteMilestone(id: string) {
  await prisma.projectMilestone.delete({ where: { id } });
}

// ─── TASKS ─────────────────────────────────────────────────

async function getProjectTasks(filters: {
  page: number;
  limit: number;
  skip: number;
  projectId?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
}) {
  const where: Prisma.ProjectTaskWhereInput = {};
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.assignedTo) where.assignedTo = { contains: filters.assignedTo, mode: "insensitive" };

  const [tasks, total] = await Promise.all([
    prisma.projectTask.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, code: true } },
        subtasks: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.projectTask.count({ where }),
  ]);

  return { tasks, total };
}

async function createTask(data: {
  projectId: string;
  title: string;
  description?: string;
  assignedTo?: string;
  priority?: string;
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number;
  parentTaskId?: string;
}) {
  const project = await prisma.project.findUnique({ where: { id: data.projectId } });
  if (!project) throw new ConstructionError("Project not found", 404);

  return prisma.projectTask.create({
    data: {
      projectId: data.projectId,
      title: data.title.trim(),
      description: data.description?.trim(),
      assignedTo: data.assignedTo?.trim(),
      priority: data.priority || "medium",
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      estimatedHours: data.estimatedHours !== undefined ? new Prisma.Decimal(data.estimatedHours) : undefined,
      parentTaskId: data.parentTaskId,
    },
    include: { project: { select: { id: true, name: true, code: true } } },
  });
}

async function updateTask(id: string, data: {
  title?: string;
  description?: string;
  assignedTo?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
}) {
  const existing = await prisma.projectTask.findUnique({ where: { id } });
  if (!existing) throw new ConstructionError("Task not found", 404);

  const isCompleting = data.status === "completed" && existing.status !== "completed";

  return prisma.projectTask.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() }),
      ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo?.trim() }),
      ...(data.priority && { priority: data.priority }),
      ...(data.status && { status: data.status }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.estimatedHours !== undefined && { estimatedHours: new Prisma.Decimal(data.estimatedHours) }),
      ...(data.actualHours !== undefined && { actualHours: new Prisma.Decimal(data.actualHours) }),
      ...(isCompleting && { completedAt: new Date() }),
    },
  });
}

async function deleteTask(id: string) {
  await prisma.projectTask.deleteMany({ where: { parentTaskId: id } });
  await prisma.projectTask.delete({ where: { id } });
}

// ─── MATERIALS ─────────────────────────────────────────────

async function getMaterials(filters: {
  page: number;
  limit: number;
  skip: number;
  category?: string;
  search?: string;
}) {
  const where: Prisma.MaterialWhereInput = {};
  if (filters.category) where.category = filters.category;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { code: { contains: filters.search, mode: "insensitive" } },
      { supplier: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [materials, total] = await Promise.all([
    prisma.material.findMany({
      where,
      orderBy: { name: "asc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.material.count({ where }),
  ]);

  return { materials, total };
}

async function createMaterial(data: {
  name: string;
  code: string;
  category: string;
  unit: string;
  unitPrice: number;
  stockQty?: number;
  reorderLevel?: number;
  supplier?: string;
}) {
  const existing = await prisma.material.findUnique({ where: { code: data.code } });
  if (existing) throw new ConstructionError("Material code already exists", 409);

  return prisma.material.create({
    data: {
      name: data.name.trim(),
      code: data.code.toUpperCase().trim(),
      category: data.category.trim(),
      unit: data.unit.trim(),
      unitPrice: new Prisma.Decimal(data.unitPrice),
      stockQty: data.stockQty !== undefined ? new Prisma.Decimal(data.stockQty) : undefined,
      reorderLevel: data.reorderLevel !== undefined ? new Prisma.Decimal(data.reorderLevel) : undefined,
      supplier: data.supplier?.trim(),
    },
  });
}

async function updateMaterial(id: string, data: {
  name?: string;
  category?: string;
  unitPrice?: number;
  stockQty?: number;
  reorderLevel?: number;
  supplier?: string;
}) {
  return prisma.material.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.category && { category: data.category.trim() }),
      ...(data.unitPrice !== undefined && { unitPrice: new Prisma.Decimal(data.unitPrice) }),
      ...(data.stockQty !== undefined && { stockQty: new Prisma.Decimal(data.stockQty) }),
      ...(data.reorderLevel !== undefined && { reorderLevel: new Prisma.Decimal(data.reorderLevel) }),
      ...(data.supplier !== undefined && { supplier: data.supplier?.trim() }),
    },
  });
}

async function getLowStockMaterials() {
  const materials = await prisma.material.findMany({
    orderBy: { name: "asc" },
  });

  return materials.filter((m) => Number(m.stockQty) <= Number(m.reorderLevel));
}

// ─── MATERIAL REQUESTS ─────────────────────────────────────

async function getMaterialRequests(filters: {
  page: number;
  limit: number;
  skip: number;
  projectId?: string;
  status?: string;
}) {
  const where: Prisma.MaterialRequestWhereInput = {};
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = filters.status;

  const [requests, total] = await Promise.all([
    prisma.materialRequest.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, code: true } },
        material: { select: { id: true, name: true, code: true, unit: true, unitPrice: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.materialRequest.count({ where }),
  ]);

  return { requests, total };
}

async function createMaterialRequest(data: {
  projectId: string;
  materialId: string;
  quantity: number;
  requestedBy: string;
  notes?: string;
}) {
  const material = await prisma.material.findUnique({ where: { id: data.materialId } });
  if (!material) throw new ConstructionError("Material not found", 404);

  return prisma.materialRequest.create({
    data: {
      projectId: data.projectId,
      materialId: data.materialId,
      quantity: new Prisma.Decimal(data.quantity),
      requestedBy: data.requestedBy.trim(),
      notes: data.notes?.trim(),
    },
    include: {
      project: { select: { id: true, name: true, code: true } },
      material: { select: { id: true, name: true, unit: true } },
    },
  });
}

async function updateMaterialRequestStatus(id: string, status: string, approvedBy?: string) {
  const request = await prisma.materialRequest.findUnique({
    where: { id },
    include: { material: true },
  });
  if (!request) throw new ConstructionError("Material request not found", 404);

  if (status === "approved" && request.status === "pending") {
    const newStock = request.material.stockQty.minus(request.quantity);
    if (Number(newStock) < 0) {
      throw new ConstructionError("Insufficient stock for this material", 400);
    }
    await prisma.material.update({
      where: { id: request.materialId },
      data: { stockQty: newStock },
    });
  }

  return prisma.materialRequest.update({
    where: { id },
    data: {
      status,
      approvedBy: approvedBy?.trim(),
      ...(status === "delivered" && { deliveryDate: new Date() }),
    },
    include: {
      project: { select: { id: true, name: true } },
      material: { select: { id: true, name: true } },
    },
  });
}

// ─── EQUIPMENT FLEET ───────────────────────────────────────

async function getEquipmentFleet(filters: {
  page: number;
  limit: number;
  skip: number;
  type?: string;
  status?: string;
  search?: string;
}) {
  const where: Prisma.EquipmentFleetWhereInput = {};
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { registrationNumber: { contains: filters.search, mode: "insensitive" } },
      { manufacturer: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [equipment, total] = await Promise.all([
    prisma.equipmentFleet.findMany({
      where,
      orderBy: { name: "asc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.equipmentFleet.count({ where }),
  ]);

  return { equipment, total };
}

async function createEquipment(data: {
  name: string;
  type: string;
  registrationNumber?: string;
  manufacturer?: string;
  model?: string;
  yearManufactured?: number;
  currentLocation?: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  hourlyRate?: number;
  notes?: string;
}) {
  if (data.registrationNumber) {
    const existing = await prisma.equipmentFleet.findUnique({
      where: { registrationNumber: data.registrationNumber },
    });
    if (existing) throw new ConstructionError("Registration number already exists", 409);
  }

  return prisma.equipmentFleet.create({
    data: {
      name: data.name.trim(),
      type: data.type.trim(),
      registrationNumber: data.registrationNumber?.trim(),
      manufacturer: data.manufacturer?.trim(),
      model: data.model?.trim(),
      yearManufactured: data.yearManufactured,
      currentLocation: data.currentLocation?.trim(),
      lastMaintenance: data.lastMaintenance ? new Date(data.lastMaintenance) : undefined,
      nextMaintenance: data.nextMaintenance ? new Date(data.nextMaintenance) : undefined,
      hourlyRate: data.hourlyRate !== undefined ? new Prisma.Decimal(data.hourlyRate) : undefined,
      notes: data.notes?.trim(),
    },
  });
}

async function updateEquipment(id: string, data: {
  name?: string;
  type?: string;
  status?: string;
  currentLocation?: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  hourlyRate?: number;
  notes?: string;
}) {
  return prisma.equipmentFleet.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.type && { type: data.type.trim() }),
      ...(data.status && { status: data.status }),
      ...(data.currentLocation !== undefined && { currentLocation: data.currentLocation?.trim() }),
      ...(data.lastMaintenance && { lastMaintenance: new Date(data.lastMaintenance) }),
      ...(data.nextMaintenance && { nextMaintenance: new Date(data.nextMaintenance) }),
      ...(data.hourlyRate !== undefined && { hourlyRate: new Prisma.Decimal(data.hourlyRate) }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() }),
    },
  });
}

async function deleteEquipment(id: string) {
  await prisma.equipmentFleet.delete({ where: { id } });
  logger.info(`Equipment deleted: ${id}`);
}

// ─── SITE REPORTS ──────────────────────────────────────────

async function getSiteReports(filters: {
  page: number;
  limit: number;
  skip: number;
  projectId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const where: Prisma.SiteReportWhereInput = {};
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.startDate || filters.endDate) {
    where.reportDate = {};
    if (filters.startDate) where.reportDate.gte = new Date(filters.startDate);
    if (filters.endDate) where.reportDate.lte = new Date(filters.endDate);
  }

  const [reports, total] = await Promise.all([
    prisma.siteReport.findMany({
      where,
      include: { project: { select: { id: true, name: true, code: true } } },
      orderBy: { reportDate: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.siteReport.count({ where }),
  ]);

  return { reports, total };
}

async function createSiteReport(data: {
  projectId: string;
  reportDate: string;
  weather?: string;
  workforceCount?: number;
  summary: string;
  issues?: string;
  safetyNotes?: string;
  photos?: string[];
  createdBy: string;
}) {
  const project = await prisma.project.findUnique({ where: { id: data.projectId } });
  if (!project) throw new ConstructionError("Project not found", 404);

  return prisma.siteReport.create({
    data: {
      projectId: data.projectId,
      reportDate: new Date(data.reportDate),
      weather: data.weather?.trim(),
      workforceCount: data.workforceCount,
      summary: data.summary.trim(),
      issues: data.issues?.trim(),
      safetyNotes: data.safetyNotes?.trim(),
      photos: data.photos as Prisma.InputJsonValue,
      createdBy: data.createdBy.trim(),
    },
    include: { project: { select: { id: true, name: true, code: true } } },
  });
}

export class ConstructionError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "ConstructionError";
    this.statusCode = statusCode;
  }
}

const constructionService = {
  getProjects, getProjectById, createProject, updateProject, deleteProject, getProjectSummary,
  getProjectMilestones, createMilestone, updateMilestone, deleteMilestone,
  getProjectTasks, createTask, updateTask, deleteTask,
  getMaterials, createMaterial, updateMaterial, getLowStockMaterials,
  getMaterialRequests, createMaterialRequest, updateMaterialRequestStatus,
  getEquipmentFleet, createEquipment, updateEquipment, deleteEquipment,
  getSiteReports, createSiteReport,
};

export default constructionService;
