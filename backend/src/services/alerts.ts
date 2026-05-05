import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";

// ─── ALERT RULES ───────────────────────────────────────────

async function getAlertRules(filters: { module?: string; isActive?: boolean; organizationId?: string }) {
  const where: Prisma.AlertRuleWhereInput = {};
  if (filters.module) where.module = filters.module;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.organizationId) where.organizationId = filters.organizationId;

  return prisma.alertRule.findMany({
    where,
    include: {
      recipients: true,
      _count: { select: { alerts: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function getAlertRuleById(id: string, organizationId?: string) {
  return prisma.alertRule.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
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
  organizationId?: string | null;
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
      organizationId: data.organizationId ?? undefined,
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
}, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.alertRule.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new AlertError("Alert rule not found", 404);
  }
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

async function deleteAlertRule(id: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.alertRule.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new AlertError("Alert rule not found", 404);
  }
  // Detach any alerts that reference this rule — keep their history but null the FK.
  await prisma.$transaction([
    prisma.alert.updateMany({ where: { ruleId: id }, data: { ruleId: null } }),
    prisma.alertRecipient.deleteMany({ where: { ruleId: id } }),
    prisma.alertRule.delete({ where: { id } }),
  ]);
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
  organizationId?: string;
}) {
  const where: Prisma.AlertWhereInput = {};
  if (filters.module) where.module = filters.module;
  if (filters.severity) where.severity = filters.severity;
  if (filters.isRead !== undefined) where.isRead = filters.isRead;
  if (filters.isResolved !== undefined) where.isResolved = filters.isResolved;
  if (filters.organizationId) where.organizationId = filters.organizationId;

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

async function getAlertById(id: string, organizationId?: string) {
  return prisma.alert.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
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
  organizationId?: string | null;
}) {
  const alert = await prisma.alert.create({
    data: {
      ruleId: data.ruleId,
      title: data.title.trim(),
      message: data.message.trim(),
      severity: data.severity || "medium",
      module: data.module,
      metadata: data.metadata as Prisma.InputJsonValue,
      organizationId: data.organizationId ?? undefined,
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

async function markAlertRead(id: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.alert.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new AlertError("Alert not found", 404);
  }
  return prisma.alert.update({
    where: { id },
    data: { isRead: true },
  });
}

async function markAllAlertsRead(module?: string, organizationId?: string) {
  const where: Prisma.AlertWhereInput = { isRead: false };
  if (module) where.module = module;
  if (organizationId) where.organizationId = organizationId;

  const result = await prisma.alert.updateMany({
    where,
    data: { isRead: true },
  });

  return result.count;
}

async function resolveAlert(id: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.alert.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new AlertError("Alert not found", 404);
  }
  return prisma.alert.update({
    where: { id },
    data: { isResolved: true, resolvedAt: new Date() },
  });
}

async function deleteAlert(id: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.alert.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new AlertError("Alert not found", 404);
  }
  await prisma.alert.delete({ where: { id } });
}

async function getAlertStats(organizationId?: string) {
  const baseWhere: Prisma.AlertWhereInput = organizationId ? { organizationId } : {};
  const [total, unread, bySeverity, byModule, recent] = await Promise.all([
    prisma.alert.count({ where: baseWhere }),
    prisma.alert.count({ where: { ...baseWhere, isRead: false } }),
    prisma.alert.groupBy({ by: ["severity"], where: baseWhere, _count: true }),
    prisma.alert.groupBy({ by: ["module"], where: baseWhere, _count: true, orderBy: { _count: { module: "desc" } } }),
    prisma.alert.findMany({
      where: baseWhere,
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
  organizationId?: string;
}) {
  const where: Prisma.OptimizationSuggestionWhereInput = {};
  if (filters.module) where.module = filters.module;
  if (filters.status) where.status = filters.status;
  if (filters.impact) where.impact = filters.impact;
  if (filters.organizationId) where.organizationId = filters.organizationId;

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
  organizationId?: string | null;
}) {
  return prisma.optimizationSuggestion.create({
    data: {
      module: data.module,
      title: data.title.trim(),
      description: data.description.trim(),
      impact: data.impact,
      effort: data.effort,
      data: data.data as Prisma.InputJsonValue,
      organizationId: data.organizationId ?? undefined,
    },
  });
}

async function updateOptimizationSuggestionStatus(id: string, status: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.optimizationSuggestion.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new AlertError("Suggestion not found", 404);
  }
  return prisma.optimizationSuggestion.update({
    where: { id },
    data: { status },
  });
}

// ─── AUTO-GENERATE OPTIMIZATION SUGGESTIONS ────────────────
// Scans real operational data across modules and creates actionable suggestions.
async function generateOptimizationSuggestions(organizationId?: string): Promise<{
  created: number;
  scanned: string[];
  items: Array<{ id: string; module: string; title: string; description: string; impact: string; effort: string; status: string; createdAt: Date }>;
  skipped: number;
}> {
  const created: Array<{ module: string; title: string; description: string; impact: string; effort: string; data?: Record<string, unknown> }> = [];
  const scanned: string[] = [];
  const orgFilter = organizationId ? { organizationId } : {};

  // ── Finance: budget overrun ──
  scanned.push("finance");
  const currentYear = new Date().getFullYear();
  const budgets = await prisma.annualBudget.findMany({
    where: {
      fiscalYear: currentYear,
      status: "active",
      ...(organizationId ? { category: { organizationId } } : {}),
    },
    include: { category: true },
  });
  for (const b of budgets) {
    const allocated = Number(b.allocatedAmount);
    const spent = Number(b.spentAmount);
    const utilization = allocated > 0 ? (spent / allocated) * 100 : 0;
    if (utilization >= 90 && b.category) {
      created.push({
        module: "finance",
        title: `Budget category "${b.category.name}" at ${utilization.toFixed(0)}% utilization`,
        description: `Spending is approaching the annual limit. Consider reallocating funds from under-utilized categories or requesting a supplement before the fiscal year closes.`,
        impact: utilization >= 100 ? "high" : "medium",
        effort: "low",
        data: { categoryId: b.categoryId, utilization, allocated, spent },
      });
    }
  }

  // ── ICT: open ticket backlog ──
  scanned.push("ict");
  const openTickets = await prisma.itTicket.count({
    where: { status: { in: ["open", "in_progress"] }, ...orgFilter },
  });
  if (openTickets >= 10) {
    created.push({
      module: "ict",
      title: `${openTickets} open IT tickets — backlog growing`,
      description: `Review ticket routing and prioritise ageing tickets. Consider temporary capacity increase or triaging low-priority items.`,
      impact: openTickets >= 25 ? "high" : "medium",
      effort: "medium",
      data: { openTickets },
    });
  }

  // ── HR: pending leaves ──
  scanned.push("hr");
  const pendingLeaves = await prisma.leaveRequest.count({
    where: {
      status: "pending",
      ...(organizationId ? { employee: { organizationId } } : {}),
    },
  });
  if (pendingLeaves >= 5) {
    created.push({
      module: "hr",
      title: `${pendingLeaves} leave requests awaiting approval`,
      description: `Managers have pending leave approvals. Delays impact planning and employee experience — process within 48 hours.`,
      impact: "low",
      effort: "low",
      data: { pendingLeaves },
    });
  }

  // ── Construction: behind-schedule projects ──
  scanned.push("construction");
  const projects = await prisma.project.findMany({
    where: { status: { in: ["in_progress", "planning"] }, ...orgFilter },
    select: { id: true, name: true, progress: true, endDate: true, startDate: true },
  });
  const now = Date.now();
  for (const p of projects) {
    if (!p.startDate || !p.endDate) continue;
    const total = p.endDate.getTime() - p.startDate.getTime();
    const elapsed = now - p.startDate.getTime();
    const expectedPct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
    const actualPct = Number(p.progress) || 0;
    if (expectedPct - actualPct >= 20) {
      created.push({
        module: "construction",
        title: `Project "${p.name}" is ${Math.round(expectedPct - actualPct)}% behind schedule`,
        description: `Expected progress is ${expectedPct.toFixed(0)}% but actual is ${actualPct.toFixed(0)}%. Review blockers, resourcing, and revise timeline if needed.`,
        impact: "high",
        effort: "medium",
        data: { projectId: p.id, expectedPct, actualPct },
      });
    }
  }

  // ── Workforce: attrition risk ──
  scanned.push("workforce");
  const highRisk = await prisma.attritionPrediction.count({
    where: {
      riskLevel: "high",
      ...(organizationId ? { employee: { organizationId } } : {}),
    },
  });
  if (highRisk >= 3) {
    created.push({
      module: "workforce",
      title: `${highRisk} employees flagged as high attrition risk`,
      description: `Schedule stay-interviews, review compensation, and check workload distribution in affected departments before they resign.`,
      impact: "high",
      effort: "medium",
      data: { highRiskCount: highRisk },
    });
  }

  // ── Accounting: overdue invoices ──
  scanned.push("accounting");
  const overdue = await prisma.invoice.count({
    where: { status: { in: ["sent", "partial"] }, dueDate: { lt: new Date() }, ...orgFilter },
  });
  if (overdue >= 3) {
    created.push({
      module: "accounting",
      title: `${overdue} invoices are past due`,
      description: `Follow up with clients on overdue invoices to improve cash flow. Consider offering payment plans for ageing receivables.`,
      impact: overdue >= 10 ? "high" : "medium",
      effort: "low",
      data: { overdue },
    });
  }

  // Persist — skip duplicates (same title in last 24h within same org)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let createdCount = 0;
  let skippedCount = 0;
  const items: Array<{ id: string; module: string; title: string; description: string; impact: string; effort: string; status: string; createdAt: Date }> = [];
  for (const s of created) {
    const existing = await prisma.optimizationSuggestion.findFirst({
      where: { title: s.title, createdAt: { gte: since }, ...orgFilter },
    });
    if (existing) {
      skippedCount++;
      continue;
    }
    const saved = await prisma.optimizationSuggestion.create({
      data: {
        module: s.module,
        title: s.title,
        description: s.description,
        impact: s.impact,
        effort: s.effort,
        data: (s.data || {}) as Prisma.InputJsonValue,
        organizationId: organizationId ?? undefined,
      },
    });
    items.push({
      id: saved.id,
      module: saved.module,
      title: saved.title,
      description: saved.description,
      impact: saved.impact,
      effort: saved.effort,
      status: saved.status,
      createdAt: saved.createdAt,
    });
    createdCount++;
  }

  logger.info(`Optimization scan complete: scanned ${scanned.length} modules, created ${createdCount} suggestions, skipped ${skippedCount} duplicates`);
  return { created: createdCount, scanned, items, skipped: skippedCount };
}

// ─── ALERT ENGINE (runs on cron) ───────────────────────────

async function evaluateAlertRules() {
  // Runs across all orgs; each rule's organizationId is stamped on any
  // alert it produces, keeping downstream reads scoped correctly.
  const rules = await prisma.alertRule.findMany({
    where: { isActive: true },
  });

  let triggeredCount = 0;

  for (const rule of rules) {
    if (rule.lastTriggered) {
      const cooldownMs = rule.cooldownMin * 60 * 1000;
      if (Date.now() - rule.lastTriggered.getTime() < cooldownMs) continue;
    }

    const currentValue = await getMetricValue(rule.module, rule.metric, rule.organizationId || undefined);
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
        organizationId: rule.organizationId,
      });
      triggeredCount++;
    }
  }

  logger.info(`Alert engine evaluated ${rules.length} rules, triggered ${triggeredCount}`);
  return { evaluated: rules.length, triggered: triggeredCount };
}

async function getMetricValue(module: string, metric: string, organizationId?: string): Promise<number | null> {
  const orgFilter = organizationId ? { organizationId } : {};
  const employeeOrgFilter = organizationId ? { employee: { organizationId } } : {};
  const categoryOrgFilter = organizationId ? { category: { organizationId } } : {};
  switch (module) {
    case "hr": {
      if (metric === "pending_leave_requests") {
        return prisma.leaveRequest.count({ where: { status: "pending", ...employeeOrgFilter } });
      }
      if (metric === "active_employees") {
        return prisma.employee.count({ where: { status: "active", ...orgFilter } });
      }
      break;
    }
    case "finance": {
      if (metric === "budget_utilization") {
        const budgets = await prisma.annualBudget.findMany({
          where: { fiscalYear: new Date().getFullYear(), ...categoryOrgFilter },
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
        return prisma.itTicket.count({ where: { status: "open", ...orgFilter } });
      }
      if (metric === "critical_tickets") {
        return prisma.itTicket.count({ where: { priority: "critical", status: { not: "resolved" }, ...orgFilter } });
      }
      break;
    }
    case "construction": {
      if (metric === "overdue_tasks") {
        return prisma.projectTask.count({
          where: {
            status: { not: "completed" },
            dueDate: { lt: new Date() },
            ...(organizationId ? { project: { organizationId } } : {}),
          },
        });
      }
      break;
    }
    case "workforce": {
      if (metric === "high_risk_employees") {
        return prisma.attritionPrediction.count({ where: { riskLevel: "high", ...employeeOrgFilter } });
      }
      break;
    }
    case "accounting": {
      if (metric === "overdue_invoices") {
        return prisma.invoice.count({
          where: { status: { in: ["sent", "partial"] }, dueDate: { lt: new Date() }, ...orgFilter },
        });
      }
      if (metric === "unpaid_invoice_amount") {
        const result = await prisma.invoice.aggregate({
          where: { status: { in: ["sent", "partial"] }, ...orgFilter },
          _sum: { totalAmount: true, paidAmount: true },
        });
        const total = Number(result._sum.totalAmount || 0);
        const paid = Number(result._sum.paidAmount || 0);
        return total - paid;
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
  generateOptimizationSuggestions,
  evaluateAlertRules,
};

export default alertService;
