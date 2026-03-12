import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";

// ─── KPI DEFINITIONS ───────────────────────────────────────

async function getKpiDefinitions(filters: { module?: string; isActive?: boolean }) {
  const where: Prisma.KpiDefinitionWhereInput = {};
  if (filters.module) where.module = filters.module;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;

  return prisma.kpiDefinition.findMany({
    where,
    include: {
      snapshots: { take: 30, orderBy: { snapshotDate: "desc" } },
    },
    orderBy: { name: "asc" },
  });
}

async function createKpiDefinition(data: {
  name: string;
  module: string;
  metric: string;
  unit?: string;
  target?: number;
  format?: string;
}) {
  return prisma.kpiDefinition.create({
    data: {
      name: data.name.trim(),
      module: data.module,
      metric: data.metric,
      unit: data.unit?.trim(),
      target: data.target !== undefined ? new Prisma.Decimal(data.target) : undefined,
      format: data.format || "number",
    },
  });
}

async function updateKpiDefinition(id: string, data: {
  name?: string;
  target?: number;
  format?: string;
  isActive?: boolean;
}) {
  return prisma.kpiDefinition.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.target !== undefined && { target: new Prisma.Decimal(data.target) }),
      ...(data.format && { format: data.format }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

// ─── KPI SNAPSHOTS ─────────────────────────────────────────

async function recordKpiSnapshot(data: {
  kpiId: string;
  value: number;
  snapshotDate: string;
  previousValue?: number;
}) {
  return prisma.kpiSnapshot.upsert({
    where: {
      kpiId_snapshotDate: {
        kpiId: data.kpiId,
        snapshotDate: new Date(data.snapshotDate),
      },
    },
    update: {
      value: new Prisma.Decimal(data.value),
      previousValue: data.previousValue !== undefined ? new Prisma.Decimal(data.previousValue) : undefined,
    },
    create: {
      kpiId: data.kpiId,
      value: new Prisma.Decimal(data.value),
      snapshotDate: new Date(data.snapshotDate),
      previousValue: data.previousValue !== undefined ? new Prisma.Decimal(data.previousValue) : undefined,
    },
    include: { kpi: true },
  });
}

async function getLatestKpis() {
  const kpis = await prisma.kpiDefinition.findMany({
    where: { isActive: true },
    include: {
      snapshots: {
        take: 2,
        orderBy: { snapshotDate: "desc" },
      },
    },
    orderBy: { module: "asc" },
  });

  return kpis.map((kpi) => {
    const latest = kpi.snapshots[0];
    const previous = kpi.snapshots[1];

    const currentValue = latest ? Number(latest.value) : 0;
    const prevValue = previous ? Number(previous.value) : (latest?.previousValue ? Number(latest.previousValue) : 0);
    const change = prevValue > 0 ? ((currentValue - prevValue) / prevValue) * 100 : 0;

    const targetValue = kpi.target ? Number(kpi.target) : null;
    const targetProgress = targetValue && targetValue > 0 ? (currentValue / targetValue) * 100 : null;

    return {
      id: kpi.id,
      name: kpi.name,
      module: kpi.module,
      metric: kpi.metric,
      unit: kpi.unit,
      format: kpi.format,
      currentValue,
      previousValue: prevValue,
      change: Math.round(change * 100) / 100,
      target: targetValue,
      targetProgress: targetProgress ? Math.round(targetProgress * 100) / 100 : null,
      lastUpdated: latest?.snapshotDate || null,
      sparkline: kpi.snapshots.reverse().map((s) => Number(s.value)),
    };
  });
}

async function getKpiHistory(kpiId: string, days: number = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return prisma.kpiSnapshot.findMany({
    where: {
      kpiId,
      snapshotDate: { gte: startDate },
    },
    orderBy: { snapshotDate: "asc" },
  });
}

// ─── DASHBOARD LAYOUTS ─────────────────────────────────────

async function getDashboardLayouts(userId: string) {
  return prisma.dashboardLayout.findMany({
    where: { userId },
    include: { widgets: true },
    orderBy: { createdAt: "desc" },
  });
}

async function getDashboardLayoutById(id: string) {
  return prisma.dashboardLayout.findUnique({
    where: { id },
    include: { widgets: true },
  });
}

async function createDashboardLayout(data: {
  userId: string;
  name: string;
  layout: Record<string, unknown>;
  isDefault?: boolean;
  widgets?: Array<{
    widgetType: string;
    title: string;
    config: Record<string, unknown>;
    position: Record<string, unknown>;
    size: Record<string, unknown>;
  }>;
}) {
  if (data.isDefault) {
    await prisma.dashboardLayout.updateMany({
      where: { userId: data.userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.dashboardLayout.create({
    data: {
      userId: data.userId,
      name: data.name.trim(),
      layout: data.layout as Prisma.InputJsonValue,
      isDefault: data.isDefault || false,
      widgets: data.widgets ? {
        create: data.widgets.map((w) => ({
          widgetType: w.widgetType,
          title: w.title.trim(),
          config: w.config as Prisma.InputJsonValue,
          position: w.position as Prisma.InputJsonValue,
          size: w.size as Prisma.InputJsonValue,
        })),
      } : undefined,
    },
    include: { widgets: true },
  });
}

async function updateDashboardLayout(id: string, data: {
  name?: string;
  layout?: Record<string, unknown>;
  isDefault?: boolean;
}) {
  const existing = await prisma.dashboardLayout.findUnique({ where: { id } });
  if (!existing) throw new DashboardError("Layout not found", 404);

  if (data.isDefault) {
    await prisma.dashboardLayout.updateMany({
      where: { userId: existing.userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.dashboardLayout.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.layout && { layout: data.layout as Prisma.InputJsonValue }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
    },
    include: { widgets: true },
  });
}

async function deleteDashboardLayout(id: string) {
  await prisma.dashboardLayout.delete({ where: { id } });
}

// ─── DASHBOARD WIDGETS ─────────────────────────────────────

async function addWidget(data: {
  layoutId: string;
  widgetType: string;
  title: string;
  config: Record<string, unknown>;
  position: Record<string, unknown>;
  size: Record<string, unknown>;
}) {
  return prisma.dashboardWidget.create({
    data: {
      layoutId: data.layoutId,
      widgetType: data.widgetType,
      title: data.title.trim(),
      config: data.config as Prisma.InputJsonValue,
      position: data.position as Prisma.InputJsonValue,
      size: data.size as Prisma.InputJsonValue,
    },
  });
}

async function updateWidget(id: string, data: {
  title?: string;
  config?: Record<string, unknown>;
  position?: Record<string, unknown>;
  size?: Record<string, unknown>;
}) {
  return prisma.dashboardWidget.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title.trim() }),
      ...(data.config && { config: data.config as Prisma.InputJsonValue }),
      ...(data.position && { position: data.position as Prisma.InputJsonValue }),
      ...(data.size && { size: data.size as Prisma.InputJsonValue }),
    },
  });
}

async function deleteWidget(id: string) {
  await prisma.dashboardWidget.delete({ where: { id } });
}

// ─── EXECUTIVE SUMMARY ────────────────────────────────────

async function getExecutiveSummary() {
  const [
    employeeCount, departmentCount, pendingLeaves,
    transactionStats, openTickets, activeProjects,
    highRiskEmployees, unreadAlerts,
  ] = await Promise.all([
    prisma.employee.count({ where: { status: "active" } }),
    prisma.department.count({ where: { isActive: true } }),
    prisma.leaveRequest.count({ where: { status: "pending" } }),
    prisma.transaction.aggregate({
      where: { status: "completed", transactionDate: { gte: new Date(new Date().getFullYear(), 0, 1) } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.itTicket.count({ where: { status: { in: ["open", "in_progress"] } } }),
    prisma.project.count({ where: { status: { in: ["active", "in_progress"] } } }),
    prisma.attritionPrediction.count({ where: { riskLevel: "high" } }),
    prisma.alert.count({ where: { isRead: false } }),
  ]);

  const budgetSummary = await prisma.annualBudget.aggregate({
    where: { fiscalYear: new Date().getFullYear() },
    _sum: { allocatedAmount: true, spentAmount: true },
  });

  return {
    hr: {
      activeEmployees: employeeCount,
      departments: departmentCount,
      pendingLeaves,
    },
    finance: {
      ytdTransactions: transactionStats._count,
      ytdAmount: Number(transactionStats._sum.amount || 0),
      budgetAllocated: Number(budgetSummary._sum.allocatedAmount || 0),
      budgetSpent: Number(budgetSummary._sum.spentAmount || 0),
    },
    ict: {
      openTickets,
    },
    construction: {
      activeProjects,
    },
    workforce: {
      highRiskEmployees,
    },
    alerts: {
      unread: unreadAlerts,
    },
  };
}

export class DashboardError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "DashboardError";
    this.statusCode = statusCode;
  }
}

const dashboardService = {
  getKpiDefinitions, createKpiDefinition, updateKpiDefinition,
  recordKpiSnapshot, getLatestKpis, getKpiHistory,
  getDashboardLayouts, getDashboardLayoutById, createDashboardLayout, updateDashboardLayout, deleteDashboardLayout,
  addWidget, updateWidget, deleteWidget,
  getExecutiveSummary,
};

export default dashboardService;
