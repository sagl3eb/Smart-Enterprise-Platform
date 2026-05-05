import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";

// ─── KPI DEFINITIONS ───────────────────────────────────────

async function getKpiDefinitions(filters: { module?: string; isActive?: boolean; organizationId?: string }) {
  const where: Prisma.KpiDefinitionWhereInput = {};
  if (filters.module) where.module = filters.module;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.organizationId) where.organizationId = filters.organizationId;

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
  organizationId?: string | null;
}) {
  return prisma.kpiDefinition.create({
    data: {
      name: data.name.trim(),
      module: data.module,
      metric: data.metric,
      unit: data.unit?.trim(),
      target: data.target !== undefined ? new Prisma.Decimal(data.target) : undefined,
      format: data.format || "number",
      organizationId: data.organizationId ?? undefined,
    },
  });
}

async function updateKpiDefinition(id: string, data: {
  name?: string;
  target?: number;
  format?: string;
  isActive?: boolean;
}, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.kpiDefinition.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new DashboardError("KPI not found", 404);
  }
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
  organizationId?: string;
}) {
  if (data.organizationId) {
    const owned = await prisma.kpiDefinition.findFirst({
      where: { id: data.kpiId, organizationId: data.organizationId },
      select: { id: true },
    });
    if (!owned) throw new DashboardError("KPI not found", 404);
  }
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

async function getLatestKpis(organizationId?: string) {
  const kpis = await prisma.kpiDefinition.findMany({
    where: { isActive: true, ...(organizationId ? { organizationId } : {}) },
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

async function getKpiHistory(kpiId: string, days: number = 90, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.kpiDefinition.findFirst({
      where: { id: kpiId, organizationId },
      select: { id: true },
    });
    if (!owned) throw new DashboardError("KPI not found", 404);
  }
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

async function getDashboardLayoutById(id: string, userId?: string) {
  return prisma.dashboardLayout.findFirst({
    where: { id, ...(userId ? { userId } : {}) },
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
}, userId?: string) {
  const existing = await prisma.dashboardLayout.findFirst({
    where: { id, ...(userId ? { userId } : {}) },
  });
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

async function deleteDashboardLayout(id: string, userId?: string) {
  if (userId) {
    const owned = await prisma.dashboardLayout.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) throw new DashboardError("Layout not found", 404);
  }
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
}, userId?: string) {
  if (userId) {
    const owned = await prisma.dashboardLayout.findFirst({
      where: { id: data.layoutId, userId },
      select: { id: true },
    });
    if (!owned) throw new DashboardError("Layout not found", 404);
  }
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
}, userId?: string) {
  if (userId) {
    const owned = await prisma.dashboardWidget.findFirst({
      where: { id, layout: { userId } },
      select: { id: true },
    });
    if (!owned) throw new DashboardError("Widget not found", 404);
  }
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

async function deleteWidget(id: string, userId?: string) {
  if (userId) {
    const owned = await prisma.dashboardWidget.findFirst({
      where: { id, layout: { userId } },
      select: { id: true },
    });
    if (!owned) throw new DashboardError("Widget not found", 404);
  }
  await prisma.dashboardWidget.delete({ where: { id } });
}

// ─── EXECUTIVE SUMMARY ────────────────────────────────────

async function getExecutiveSummary(organizationId?: string) {
  const orgFilter = organizationId ? { organizationId } : {};
  const employeeOrgFilter = organizationId ? { employee: { organizationId } } : {};
  const categoryOrgFilter = organizationId ? { category: { organizationId } } : {};
  const [
    employeeCount, departmentCount, pendingLeaves,
    transactionStats, openTickets, activeProjects,
    highRiskEmployees, unreadAlerts,
  ] = await Promise.all([
    prisma.employee.count({ where: { status: { in: ["active", "on_leave"] }, ...orgFilter } }),
    prisma.department.count({ where: { isActive: true, ...orgFilter } }),
    prisma.leaveRequest.count({ where: { status: "pending", ...employeeOrgFilter } }),
    prisma.transaction.aggregate({
      where: {
        status: "completed",
        transactionDate: { gte: new Date(new Date().getFullYear(), 0, 1) },
        ...orgFilter,
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.itTicket.count({ where: { status: { in: ["open", "in_progress"] }, ...orgFilter } }),
    prisma.project.count({ where: { status: { in: ["active", "in_progress"] }, ...orgFilter } }),
    prisma.attritionPrediction.count({ where: { riskLevel: "high", ...employeeOrgFilter } }),
    prisma.alert.count({ where: { isRead: false, ...orgFilter } }),
  ]);

  const budgetSummary = await prisma.annualBudget.aggregate({
    where: { fiscalYear: new Date().getFullYear(), ...categoryOrgFilter },
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

// ─── CHART DATA ───────────────────────────────────────────

async function getDashboardCharts(organizationId?: string) {
  const orgFilter = organizationId ? { organizationId } : {};

  // Revenue vs Expenses — last 6 months
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const transactions = await prisma.transaction.findMany({
    where: {
      status: "completed",
      transactionDate: { gte: sixMonthsAgo },
      ...orgFilter,
    },
    select: { type: true, amount: true, transactionDate: true },
  });

  const monthBuckets: Record<string, { month: string; revenue: number; expenses: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "short" });
    monthBuckets[key] = { month: label, revenue: 0, expenses: 0 };
  }

  for (const t of transactions) {
    const d = new Date(t.transactionDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = monthBuckets[key];
    if (!bucket) continue;
    const amt = Number(t.amount);
    const type = (t.type || "").toLowerCase();
    if (type === "revenue" || type === "income" || type === "credit") {
      bucket.revenue += amt;
    } else if (type === "expense" || type === "debit") {
      bucket.expenses += amt;
    }
  }
  const monthlyRevenue = Object.values(monthBuckets);

  // Tickets by status
  const ticketGroups = await prisma.itTicket.groupBy({
    by: ["status"],
    where: { ...orgFilter },
    _count: { _all: true },
  });
  const ticketsByStatus = ticketGroups.map((g) => ({
    name: g.status.charAt(0).toUpperCase() + g.status.slice(1).replace(/_/g, " "),
    value: g._count._all,
  }));

  // Departments with headcount + avg satisfaction (derived from performance reviews)
  const departments = await prisma.department.findMany({
    where: { isActive: true, ...orgFilter },
    select: {
      name: true,
      employees: {
        where: { status: { in: ["active", "on_leave"] } },
        select: {
          id: true,
          performanceReviews: {
            orderBy: { reviewDate: "desc" },
            take: 1,
            select: { overallScore: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
    take: 10,
  });
  const deptChartData = departments
    .filter((d) => d.employees.length > 0)
    .map((d) => {
      const scores = d.employees
        .map((e) => e.performanceReviews[0]?.overallScore)
        .filter((s): s is NonNullable<typeof s> => s != null)
        .map((s) => Number(s));
      const avgSat = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        name: d.name,
        employees: d.employees.length,
        satisfaction: Math.round(avgSat * 10) / 10,
      };
    });

  return { monthlyRevenue, ticketsByStatus, deptChartData };
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
  getExecutiveSummary, getDashboardCharts,
};

export default dashboardService;
