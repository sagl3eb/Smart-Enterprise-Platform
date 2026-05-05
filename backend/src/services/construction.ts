import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import logger from "../utils/logger";

// ─── DESCRIPTION TAGS ──────────────────────────────────────
// Schema is locked, so we prefix project.description with tags:
//   [budget:<uuid>]   — links to a BudgetCategory (matches invoice pattern)
//   [team:<id1,id2>]  — employee IDs assigned to the project
// Both tags sit at the top of the description in any order.
const PROJECT_BUDGET_TAG = /\[budget:([0-9a-f-]+)\]\s*\n?/i;
const PROJECT_TEAM_TAG = /\[team:([0-9a-f,\-]*)\]\s*\n?/i;

function encodeProjectMeta(
  budgetCategoryId: string | null | undefined,
  teamMemberIds: string[] | undefined,
  description: string | null | undefined,
): string | undefined {
  const clean = (description ?? "").trim();
  const parts: string[] = [];
  if (budgetCategoryId) parts.push(`[budget:${budgetCategoryId}]`);
  if (teamMemberIds && teamMemberIds.length > 0) parts.push(`[team:${teamMemberIds.join(",")}]`);
  const prefix = parts.length > 0 ? parts.join("\n") + "\n" : "";
  return prefix + clean || undefined;
}

function decodeProjectMeta(description: string | null | undefined): {
  budgetCategoryId: string | null;
  teamMemberIds: string[];
  description: string;
} {
  if (!description) return { budgetCategoryId: null, teamMemberIds: [], description: "" };
  let text = description;
  const budgetMatch = text.match(PROJECT_BUDGET_TAG);
  const budgetCategoryId = budgetMatch ? budgetMatch[1] : null;
  if (budgetMatch) text = text.replace(PROJECT_BUDGET_TAG, "");
  const teamMatch = text.match(PROJECT_TEAM_TAG);
  const teamMemberIds = teamMatch
    ? teamMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  if (teamMatch) text = text.replace(PROJECT_TEAM_TAG, "");
  return { budgetCategoryId, teamMemberIds, description: text };
}

async function adjustBudgetSpent(
  budgetCategoryId: string,
  delta: number,
  organizationId?: string | null
) {
  if (!delta) return;
  const year = new Date().getFullYear();
  try {
    const budget = await prisma.annualBudget.findFirst({
      where: {
        categoryId: budgetCategoryId,
        fiscalYear: year,
        ...(organizationId ? { organizationId } : {}),
      },
    });
    if (!budget) return;
    const decimalDelta = new Prisma.Decimal(delta);
    const currentSpent = new Prisma.Decimal(budget.spentAmount.toString());
    const currentRemaining = new Prisma.Decimal(budget.remainingAmount.toString());
    await prisma.annualBudget.update({
      where: { id: budget.id },
      data: {
        spentAmount: currentSpent.add(decimalDelta),
        remainingAmount: currentRemaining.minus(decimalDelta),
      },
    });
    logger.info(`Project budget adjusted: ${delta >= 0 ? "+" : ""}${delta} on budget ${budget.id}`);
  } catch (err) {
    logger.warn(`Project budget adjustment skipped: ${err}`);
  }
}

// ─── PROJECTS ──────────────────────────────────────────────

async function getProjects(filters: {
  page: number;
  limit: number;
  skip: number;
  status?: string;
  search?: string;
  organizationId?: string;
}) {
  const where: Prisma.ProjectWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.organizationId) where.organizationId = filters.organizationId;
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

  const decorated = projects.map((p) => {
    const { budgetCategoryId, teamMemberIds, description } = decodeProjectMeta(p.description);
    return { ...p, budgetCategoryId, teamMemberIds, description };
  });

  return { projects: decorated, total };
}

async function getProjectById(id: string, organizationId?: string) {
  const project = await prisma.project.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
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
  if (!project) return null;
  const { budgetCategoryId, teamMemberIds, description } = decodeProjectMeta(project.description);
  return { ...project, budgetCategoryId, teamMemberIds, description };
}

async function createProject(data: {
  name: string;
  code: string;
  description?: string;
  clientName?: string;
  startDate: string;
  endDate?: string;
  estimatedBudget?: number;
  budgetCategoryId?: string;
  teamMemberIds?: string[];
  managerId?: string;
  location?: string;
  organizationId?: string | null;
}) {
  const existing = await prisma.project.findFirst({
    where: {
      code: data.code,
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
  });
  if (existing) throw new ConstructionError("Project code already exists", 409);

  const project = await prisma.project.create({
    data: {
      name: data.name.trim(),
      code: data.code.toUpperCase().trim(),
      description: encodeProjectMeta(data.budgetCategoryId, data.teamMemberIds, data.description),
      clientName: data.clientName?.trim(),
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      estimatedBudget: data.estimatedBudget !== undefined ? new Prisma.Decimal(data.estimatedBudget) : undefined,
      managerId: data.managerId,
      location: data.location?.trim(),
      organizationId: data.organizationId ?? undefined,
    },
    include: { _count: { select: { milestones: true, tasks: true } } },
  });

  // Deduct estimated budget from the linked category immediately, so finance
  // sees the committed spend the moment the project is opened.
  if (data.budgetCategoryId && data.estimatedBudget && data.estimatedBudget > 0) {
    await adjustBudgetSpent(data.budgetCategoryId, data.estimatedBudget, data.organizationId);
  }

  logger.info(`Project created: ${project.code} - ${project.name}`);
  const { budgetCategoryId, teamMemberIds, description } = decodeProjectMeta(project.description);
  return { ...project, budgetCategoryId, teamMemberIds, description };
}

async function updateProject(id: string, data: {
  name?: string;
  description?: string;
  budgetCategoryId?: string | null;
  teamMemberIds?: string[];
  clientName?: string;
  endDate?: string;
  estimatedBudget?: number;
  actualBudget?: number;
  status?: string;
  progress?: number;
  managerId?: string;
  location?: string;
}, organizationId?: string) {
  const existing = await prisma.project.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
  if (!existing) throw new ConstructionError("Project not found", 404);

  const prior = decodeProjectMeta(existing.description);
  const priorBudgetId = prior.budgetCategoryId;
  const priorAmount = Number(existing.estimatedBudget || 0);

  const nextBudgetId =
    data.budgetCategoryId === undefined ? priorBudgetId : data.budgetCategoryId;
  const nextAmount =
    data.estimatedBudget !== undefined ? data.estimatedBudget : priorAmount;
  const nextTeam =
    data.teamMemberIds === undefined ? prior.teamMemberIds : data.teamMemberIds;

  let nextDescription: string | undefined;
  if (
    data.description !== undefined ||
    data.budgetCategoryId !== undefined ||
    data.teamMemberIds !== undefined
  ) {
    const plainDescription =
      data.description !== undefined ? data.description?.trim() : prior.description;
    nextDescription = encodeProjectMeta(nextBudgetId || undefined, nextTeam, plainDescription);
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(nextDescription !== undefined && { description: nextDescription }),
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

  // Reconcile linked budget spend when the category or amount changes.
  if (priorBudgetId === nextBudgetId) {
    if (priorBudgetId && priorAmount !== nextAmount) {
      await adjustBudgetSpent(priorBudgetId, nextAmount - priorAmount, existing.organizationId);
    }
  } else {
    if (priorBudgetId && priorAmount > 0) {
      await adjustBudgetSpent(priorBudgetId, -priorAmount, existing.organizationId);
    }
    if (nextBudgetId && nextAmount > 0) {
      await adjustBudgetSpent(nextBudgetId, nextAmount, existing.organizationId);
    }
  }

  const { budgetCategoryId, teamMemberIds, description } = decodeProjectMeta(updated.description);
  return { ...updated, budgetCategoryId, teamMemberIds, description };
}

async function deleteProject(id: string, organizationId?: string) {
  const existing = await prisma.project.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
  if (!existing) throw new ConstructionError("Project not found", 404);
  await prisma.project.update({ where: { id }, data: { status: "cancelled" } });
  logger.info(`Project cancelled: ${existing.code}`);
}

async function getProjectSummary(organizationId?: string) {
  const baseWhere: Prisma.ProjectWhereInput = organizationId ? { organizationId } : {};
  const [total, byStatus, totalBudget] = await Promise.all([
    prisma.project.count({ where: baseWhere }),
    prisma.project.groupBy({ by: ["status"], where: baseWhere, _count: true }),
    prisma.project.aggregate({
      where: baseWhere,
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

async function getProjectMilestones(projectId: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!owned) throw new ConstructionError("Project not found", 404);
  }
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
  organizationId?: string;
}) {
  const project = await prisma.project.findFirst({
    where: {
      id: data.projectId,
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
  });
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
}, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.projectMilestone.findFirst({
      where: { id, project: { organizationId } },
      select: { id: true },
    });
    if (!owned) throw new ConstructionError("Milestone not found", 404);
  }
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

async function deleteMilestone(id: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.projectMilestone.findFirst({
      where: { id, project: { organizationId } },
      select: { id: true },
    });
    if (!owned) throw new ConstructionError("Milestone not found", 404);
  }
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
  organizationId?: string;
}) {
  const where: Prisma.ProjectTaskWhereInput = {};
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.assignedTo) where.assignedTo = { contains: filters.assignedTo, mode: "insensitive" };
  if (filters.organizationId) where.project = { organizationId: filters.organizationId };

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
  organizationId?: string;
}) {
  const project = await prisma.project.findFirst({
    where: {
      id: data.projectId,
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
  });
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
}, organizationId?: string) {
  const existing = await prisma.projectTask.findFirst({
    where: {
      id,
      ...(organizationId ? { project: { organizationId } } : {}),
    },
  });
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

async function deleteTask(id: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.projectTask.findFirst({
      where: { id, project: { organizationId } },
      select: { id: true },
    });
    if (!owned) throw new ConstructionError("Task not found", 404);
  }
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
  organizationId?: string;
}) {
  const where: Prisma.MaterialWhereInput = {};
  if (filters.category) where.category = filters.category;
  if (filters.organizationId) where.organizationId = filters.organizationId;
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
  organizationId?: string | null;
}) {
  const existing = await prisma.material.findFirst({
    where: {
      code: data.code,
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
  });
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
      organizationId: data.organizationId ?? undefined,
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
}, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.material.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new ConstructionError("Material not found", 404);
  }
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

async function deleteMaterial(id: string, organizationId?: string) {
  const existing = await prisma.material.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
    select: { id: true, _count: { select: { materialRequests: true } } },
  });
  if (!existing) throw new ConstructionError("Material not found", 404);
  if (existing._count.materialRequests > 0) {
    throw new ConstructionError("Cannot delete — material has request history. Adjust stock to 0 instead.", 409);
  }
  await prisma.material.delete({ where: { id } });
  logger.info(`Material deleted: ${id}`);
}

async function getLowStockMaterials(organizationId?: string) {
  const materials = await prisma.material.findMany({
    where: organizationId ? { organizationId } : {},
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
  organizationId?: string;
}) {
  const where: Prisma.MaterialRequestWhereInput = {};
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = filters.status;
  if (filters.organizationId) where.project = { organizationId: filters.organizationId };

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
  organizationId?: string;
  requesterUserId?: string;
  requesterRole?: string;
}) {
  const material = await prisma.material.findFirst({
    where: {
      id: data.materialId,
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
  });
  if (!material) throw new ConstructionError("Material not found", 404);

  const project = await prisma.project.findFirst({
    where: {
      id: data.projectId,
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
    select: { id: true, description: true },
  });
  if (!project) throw new ConstructionError("Project not found", 404);

  const privilegedRoles = ["super_admin", "admin", "manager"];
  const isPrivileged = data.requesterRole ? privilegedRoles.includes(data.requesterRole) : false;
  if (!isPrivileged) {
    const { teamMemberIds } = decodeProjectMeta(project.description);
    if (!data.requesterUserId) {
      throw new ConstructionError("You must be on the project team to request materials", 403);
    }
    const emp = await prisma.employee.findUnique({
      where: { userId: data.requesterUserId },
      select: { id: true },
    });
    if (!emp || !teamMemberIds.includes(emp.id)) {
      throw new ConstructionError("You must be on the project team to request materials", 403);
    }
  }

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

async function updateMaterialRequestStatus(id: string, status: string, approvedBy?: string, organizationId?: string) {
  const request = await prisma.materialRequest.findFirst({
    where: {
      id,
      ...(organizationId ? { project: { organizationId } } : {}),
    },
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
  organizationId?: string;
}) {
  const where: Prisma.EquipmentFleetWhereInput = {};
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.organizationId) where.organizationId = filters.organizationId;
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
  organizationId?: string | null;
}) {
  if (data.registrationNumber) {
    const existing = await prisma.equipmentFleet.findFirst({
      where: {
        registrationNumber: data.registrationNumber,
        ...(data.organizationId ? { organizationId: data.organizationId } : {}),
      },
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
      organizationId: data.organizationId ?? undefined,
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
}, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.equipmentFleet.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new ConstructionError("Equipment not found", 404);
  }
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

async function deleteEquipment(id: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.equipmentFleet.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new ConstructionError("Equipment not found", 404);
  }
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
  organizationId?: string;
}) {
  const where: Prisma.SiteReportWhereInput = {};
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.organizationId) where.project = { organizationId: filters.organizationId };
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
  organizationId?: string;
}) {
  const project = await prisma.project.findFirst({
    where: {
      id: data.projectId,
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
  });
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

// ─── SUPPLIERS ─────────────────────────────────────────────
// Schema is locked and has no Supplier table. We store the supplier registry
// as a tag-encoded JSON blob inside Organization.description:
//   [suppliers:<base64-json>]
// Same pattern as [budget:...] and [team:...] tags on projects.
const SUPPLIER_TAG = /\[suppliers:([A-Za-z0-9+/=]+)\]\s*\n?/;

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

function decodeSuppliers(description: string | null | undefined): {
  suppliers: Supplier[];
  rest: string;
} {
  if (!description) return { suppliers: [], rest: "" };
  const match = description.match(SUPPLIER_TAG);
  if (!match) return { suppliers: [], rest: description };
  let suppliers: Supplier[] = [];
  try {
    const json = Buffer.from(match[1], "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) suppliers = parsed;
  } catch {
    // Malformed tag — treat as empty, but keep the rest so we don't lose text.
  }
  return { suppliers, rest: description.replace(SUPPLIER_TAG, "") };
}

function encodeSuppliers(suppliers: Supplier[], rest: string): string | null {
  const clean = (rest ?? "").trim();
  if (suppliers.length === 0) return clean || null;
  const json = JSON.stringify(suppliers);
  const b64 = Buffer.from(json, "utf8").toString("base64");
  return `[suppliers:${b64}]` + (clean ? "\n" + clean : "");
}

async function loadOrgForSuppliers(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, description: true },
  });
  if (!org) throw new ConstructionError("Organization not found", 404);
  return org;
}

async function getSuppliers(organizationId?: string): Promise<Supplier[]> {
  if (!organizationId) return [];
  const org = await loadOrgForSuppliers(organizationId);
  return decodeSuppliers(org.description).suppliers;
}

async function createSupplier(
  data: Omit<Supplier, "id"> & { id?: string },
  organizationId?: string
): Promise<Supplier> {
  if (!organizationId) throw new ConstructionError("Organization required for supplier registry", 400);
  const name = (data.name || "").trim();
  if (!name) throw new ConstructionError("Supplier name is required", 400);

  const org = await loadOrgForSuppliers(organizationId);
  const { suppliers, rest } = decodeSuppliers(org.description);

  if (suppliers.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    throw new ConstructionError("Supplier with this name already exists", 409);
  }

  const supplier: Supplier = {
    id: data.id || randomUUID(),
    name,
    contactName: data.contactName?.trim() || undefined,
    email: data.email?.trim() || undefined,
    phone: data.phone?.trim() || undefined,
    address: data.address?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
  };

  const next = [...suppliers, supplier];
  await prisma.organization.update({
    where: { id: organizationId },
    data: { description: encodeSuppliers(next, rest) },
  });
  return supplier;
}

async function updateSupplier(
  id: string,
  data: Partial<Omit<Supplier, "id">>,
  organizationId?: string
): Promise<Supplier> {
  if (!organizationId) throw new ConstructionError("Organization required", 400);
  const org = await loadOrgForSuppliers(organizationId);
  const { suppliers, rest } = decodeSuppliers(org.description);

  const idx = suppliers.findIndex((s) => s.id === id);
  if (idx === -1) throw new ConstructionError("Supplier not found", 404);

  const prev = suppliers[idx];
  const nextName = data.name !== undefined ? data.name.trim() : prev.name;
  if (!nextName) throw new ConstructionError("Supplier name is required", 400);
  if (
    nextName.toLowerCase() !== prev.name.toLowerCase() &&
    suppliers.some((s) => s.id !== id && s.name.toLowerCase() === nextName.toLowerCase())
  ) {
    throw new ConstructionError("Supplier with this name already exists", 409);
  }

  const updated: Supplier = {
    id: prev.id,
    name: nextName,
    contactName: data.contactName !== undefined ? data.contactName.trim() || undefined : prev.contactName,
    email: data.email !== undefined ? data.email.trim() || undefined : prev.email,
    phone: data.phone !== undefined ? data.phone.trim() || undefined : prev.phone,
    address: data.address !== undefined ? data.address.trim() || undefined : prev.address,
    notes: data.notes !== undefined ? data.notes.trim() || undefined : prev.notes,
  };

  const nextList = [...suppliers];
  nextList[idx] = updated;

  await prisma.organization.update({
    where: { id: organizationId },
    data: { description: encodeSuppliers(nextList, rest) },
  });

  // Cascade rename onto existing materials referencing the old supplier name.
  if (updated.name !== prev.name) {
    await prisma.material.updateMany({
      where: { organizationId, supplier: prev.name },
      data: { supplier: updated.name },
    });
  }

  return updated;
}

async function deleteSupplier(id: string, organizationId?: string): Promise<void> {
  if (!organizationId) throw new ConstructionError("Organization required", 400);
  const org = await loadOrgForSuppliers(organizationId);
  const { suppliers, rest } = decodeSuppliers(org.description);

  const target = suppliers.find((s) => s.id === id);
  if (!target) throw new ConstructionError("Supplier not found", 404);

  const inUse = await prisma.material.count({
    where: { organizationId, supplier: target.name },
  });
  if (inUse > 0) {
    throw new ConstructionError(
      `Cannot delete — ${inUse} material(s) still reference this supplier. Reassign them first.`,
      409
    );
  }

  const next = suppliers.filter((s) => s.id !== id);
  await prisma.organization.update({
    where: { id: organizationId },
    data: { description: encodeSuppliers(next, rest) },
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
  getMaterials, createMaterial, updateMaterial, deleteMaterial, getLowStockMaterials,
  getMaterialRequests, createMaterialRequest, updateMaterialRequestStatus,
  getEquipmentFleet, createEquipment, updateEquipment, deleteEquipment,
  getSiteReports, createSiteReport,
  getSuppliers, createSupplier, updateSupplier, deleteSupplier,
};

export default constructionService;
