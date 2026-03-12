import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";

// ─── ALERT RULES ───────────────────────────────────────────

async function getAlertRules(filters: { module?: string; isActive?: boolean }) {
  const where: Prisma.AlertRuleWhereInput = {};
  if (filters.module) where.module = filters.module;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;

  return prisma.alertRule.findMany({
    where,
    include: {
      recipients: true,
      _count: { select: { alerts: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function getAlertRuleById(id: string) {
  return prisma.alertRule.findUnique({
    where: { id },
    include: { recipients: true, alerts: { take: 10, orderBy: { createdAt: "desc" } } },
  });
}

async function createAlertRule(data: {
  name: string;
  module: string;
  metric: string;
  condition: string;
  threshold: number;
  severity?: string;
  cooldownMin?: number;
  createdBy?: string;
  recipientUserIds?: string[];
}) {
  if (!["gt", "lt", "gte", "lte", "eq", "anomaly"].includes(data.condition)) {
    throw new AlertError("Condition must be: gt, lt, gte, lte, eq, or anomaly", 400);
  }

  const rule = await prisma.alertRule.create({
    data: {
      name: data.name.trim(),
      module: data.module,
      metric: data.metric,
      condition: data.condition,
      threshold: new Prisma.Decimal(data.threshold),
      severity: data.severity || "medium",
      cooldownMin: data.cooldownMin || 60,
      createdBy: data.createdBy,
      recipients: data.recipientUserIds ? {
        create: data.recipientUserIds.map((userId) => ({
          userId,
          channel: "in_app",
        })),
      } : undefined,
    },
    include: { recipients: true },
  });

  logger.info(`Alert rule created: ${rule.name}`);
  return rule;
}

async function updateAlertRule(id: string, data: {
  name?: string;
  condition?: string;
  threshold?: number;
  severity?: string;
  isActive?: boolean;
  cooldownMin?: number;
}) {
  return prisma.alertRule.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.condition && { condition: data.condition }),
      ...(data.threshold !== undefined && { threshold: new Prisma.Decimal(data.threshold) }),
      ...(data.severity && { severity: data.severity }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.cooldownMin !== undefined && { cooldownMin: data.cooldownMin }),
    },
    include: { recipients: true },
  });
}

async function deleteAlertRule(id: string) {
  await prisma.alertRule.delete({ where: { id } });
  logger.info(`Alert rule deleted: ${id}`);
}

// ─── ALERTS ────────────────────────────────────────────────

async function getAlerts(filters: {
  page: number;
  limit: number;
  skip: number;
  module?: string;
  severity?: string;
  isRead?: boolean;
  isResolved?: boolean;
}) {
  const where: Prisma.AlertWhereInput = {};
  if (filters.module) where.module = filters.module;
  if (filters.severity) where.severity = filters.severity;
  if (filters.isRead !== undefined) where.isRead = filters.isRead;
  if (filters.isResolved !== undefined) where.isResolved = filters.isResolved;

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      include: { rule: { select: { id: true, name: true, metric: true } } },
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.alert.count({ where }),
  ]);

  return { alerts, total };
}

async function getAlertById(id: string) {
  return prisma.alert.findUnique({
    where: { id },
    include: { rule: true },
  });
}

async function createAlert(data: {
  ruleId?: string;
  title: string;
  message: string;
  severity?: string;
  module: string;
  metadata?: Record<string, unknown>;
}) {
  const alert = await prisma.alert.create({
    data: {
      ruleId: data.ruleId,
      title: data.title.trim(),
      message: data.message.trim(),
      severity: data.severity || "medium",
      module: data.module,
      metadata: data.metadata as Prisma.InputJsonValue,
    },
  });

  if (data.ruleId) {
    await prisma.alertRule.update({
      where: { id: data.ruleId },
      data: { lastTriggered: new Date() },
    });
  }

  logger.info(`Alert created: [${alert.severity}] ${alert.title}`);
  return alert;
}

async function markAlertRead(id: string) {
  return prisma.alert.update({
    where: { id },
    data: { isRead: true },
  });
}

async function markAllAlertsRead(module?: string) {
  const where: Prisma.AlertWhereInput = { isRead: false };
  if (module) where.module = module;

  const result = await prisma.alert.updateMany({
    where,
    data: { isRead: true },
  });

  return result.count;
}

async function resolveAlert(id: string) {
  return prisma.alert.update({
    where: { id },
    data: { isResolved: true, resolvedAt: new Date() },
  });
}

async function deleteAlert(id: string) {
  await prisma.alert.delete({ where: { id } });
}

async function getAlertStats() {
  const [total, unread, bySeverity, byModule, recent] = await Promise.all([
    prisma.alert.count(),
    prisma.alert.count({ where: { isRead: false } }),
    prisma.alert.groupBy({ by: ["severity"], _count: true }),
    prisma.alert.groupBy({ by: ["module"], _count: true, orderBy: { _count: { module: "desc" } } }),
    prisma.alert.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, severity: true, module: true, isRead: true, createdAt: true },
    }),
  ]);

  return {
    total,
    unread,
    bySeverity: bySeverity.map((s) => ({ severity: s.severity, count: s._count })),
    byModule: byModule.map((m) => ({ module: m.module, count: m._count })),
    recent,
  };
}

// ─── OPTIMIZATION SUGGESTIONS ──────────────────────────────

async function getOptimizationSuggestions(filters: {
  page: number;
  limit: number;
  skip: number;
  module?: string;
  status?: string;
  impact?: string;
}) {
  const where: Prisma.OptimizationSuggestionWhereInput = {};
  if (filters.module) where.module = filters.module;
  if (filters.status) where.status = filters.status;
  if (filters.impact) where.impact = filters.impact;

  const [suggestions, total] = await Promise.all([
    prisma.optimizationSuggestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.optimizationSuggestion.count({ where }),
  ]);

  return { suggestions, total };
}

async function createOptimizationSuggestion(data: {
  module: string;
  title: string;
  description: string;
  impact: string;
  effort: string;
  data?: Record<string, unknown>;
}) {
  return prisma.optimizationSuggestion.create({
    data: {
      module: data.module,
      title: data.title.trim(),
      description: data.description.trim(),
      impact: data.impact,
      effort: data.effort,
      data: data.data as Prisma.InputJsonValue,
    },
  });
}

async function updateOptimizationSuggestionStatus(id: string, status: string) {
  return prisma.optimizationSuggestion.update({
    where: { id },
    data: { status },
  });
}

// ─── ALERT ENGINE (runs on cron) ───────────────────────────

async function evaluateAlertRules() {
  const rules = await prisma.alertRule.findMany({
    where: { isActive: true },
  });

  let triggeredCount = 0;

  for (const rule of rules) {
    if (rule.lastTriggered) {
      const cooldownMs = rule.cooldownMin * 60 * 1000;
      if (Date.now() - rule.lastTriggered.getTime() < cooldownMs) continue;
    }

    const currentValue = await getMetricValue(rule.module, rule.metric);
    if (currentValue === null) continue;

    const threshold = Number(rule.threshold);
    let triggered = false;

    switch (rule.condition) {
      case "gt": triggered = currentValue > threshold; break;
      case "lt": triggered = currentValue < threshold; break;
      case "gte": triggered = currentValue >= threshold; break;
      case "lte": triggered = currentValue <= threshold; break;
      case "eq": triggered = Math.abs(currentValue - threshold) < 0.01; break;
      case "anomaly": triggered = Math.abs(currentValue - threshold) > threshold * 0.3; break;
    }

    if (triggered) {
      await createAlert({
        ruleId: rule.id,
        title: `Alert: ${rule.name}`,
        message: `${rule.metric} is ${currentValue} (threshold: ${rule.condition} ${threshold})`,
        severity: rule.severity,
        module: rule.module,
        metadata: { currentValue, threshold, condition: rule.condition },
      });
      triggeredCount++;
    }
  }

  logger.info(`Alert engine evaluated ${rules.length} rules, triggered ${triggeredCount}`);
  return { evaluated: rules.length, triggered: triggeredCount };
}

async function getMetricValue(module: string, metric: string): Promise<number | null> {
  switch (module) {
    case "hr": {
      if (metric === "pending_leave_requests") {
        return prisma.leaveRequest.count({ where: { status: "pending" } });
      }
      if (metric === "active_employees") {
        return prisma.employee.count({ where: { status: "active" } });
      }
      break;
    }
    case "finance": {
      if (metric === "budget_utilization") {
        const budgets = await prisma.annualBudget.findMany({
          where: { fiscalYear: new Date().getFullYear() },
        });
        if (budgets.length === 0) return null;
        const totalAllocated = budgets.reduce((s, b) => s + Number(b.allocatedAmount), 0);
        const totalSpent = budgets.reduce((s, b) => s + Number(b.spentAmount), 0);
        return totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
      }
      break;
    }
    case "ict": {
      if (metric === "open_tickets") {
        return prisma.itTicket.count({ where: { status: "open" } });
      }
      if (metric === "critical_tickets") {
        return prisma.itTicket.count({ where: { priority: "critical", status: { not: "resolved" } } });
      }
      break;
    }
    case "construction": {
      if (metric === "overdue_tasks") {
        return prisma.projectTask.count({
          where: { status: { not: "completed" }, dueDate: { lt: new Date() } },
        });
      }
      break;
    }
    case "workforce": {
      if (metric === "high_risk_employees") {
        return prisma.attritionPrediction.count({ where: { riskLevel: "high" } });
      }
      break;
    }
  }
  return null;
}

export class AlertError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "AlertError";
    this.statusCode = statusCode;
  }
}

const alertService = {
  getAlertRules, getAlertRuleById, createAlertRule, updateAlertRule, deleteAlertRule,
  getAlerts, getAlertById, createAlert, markAlertRead, markAllAlertsRead, resolveAlert, deleteAlert, getAlertStats,
  getOptimizationSuggestions, createOptimizationSuggestion, updateOptimizationSuggestionStatus,
  evaluateAlertRules,
};

export default alertService;
