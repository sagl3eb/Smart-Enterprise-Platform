import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";

// ─── BUDGET CATEGORIES ─────────────────────────────────────

async function getBudgetCategories(filters: {
  isActive?: boolean;
  type?: string;
  organizationId?: string;
}) {
  const where: Prisma.BudgetCategoryWhereInput = {};
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.type) where.type = filters.type;
  if (filters.organizationId) where.organizationId = filters.organizationId;

  return prisma.budgetCategory.findMany({
    where,
    orderBy: { name: "asc" },
  });
}

async function createBudgetCategory(data: {
  name: string;
  code: string;
  type: string;
  description?: string;
  organizationId?: string | null;
}) {
  const category = await prisma.budgetCategory.create({
    data: {
      name: data.name.trim(),
      code: data.code.toUpperCase().trim(),
      type: data.type,
      description: data.description?.trim(),
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
  });
  logger.info(`Budget category created: ${category.name}`);
  return category;
}

async function updateBudgetCategory(
  id: string,
  data: { name?: string; description?: string; isActive?: boolean },
  organizationId?: string
) {
  if (organizationId) {
    const owned = await prisma.budgetCategory.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new FinanceError("Budget category not found", 404);
  }
  return prisma.budgetCategory.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

// ─── ANNUAL BUDGETS ────────────────────────────────────────

async function getAnnualBudgets(filters: {
  page: number;
  limit: number;
  skip: number;
  fiscalYear?: number;
  categoryId?: string;
  status?: string;
  organizationId?: string;
}) {
  const where: Prisma.AnnualBudgetWhereInput = {};
  if (filters.fiscalYear) where.fiscalYear = filters.fiscalYear;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.status) where.status = filters.status;
  if (filters.organizationId) where.organizationId = filters.organizationId;

  const [budgets, total] = await Promise.all([
    prisma.annualBudget.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, code: true, type: true } },
      },
      orderBy: [{ fiscalYear: "desc" }, { category: { name: "asc" } }],
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.annualBudget.count({ where }),
  ]);

  return { budgets, total };
}

async function getAnnualBudgetById(id: string, organizationId?: string) {
  return prisma.annualBudget.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
    include: {
      category: true,
    },
  });
}

async function createAnnualBudget(data: {
  categoryId: string;
  fiscalYear: number;
  allocatedAmount: number;
  notes?: string;
  organizationId?: string | null;
}) {
  const existing = await prisma.annualBudget.findUnique({
    where: {
      categoryId_fiscalYear: {
        categoryId: data.categoryId,
        fiscalYear: data.fiscalYear,
      },
    },
  });

  if (existing) {
    throw new FinanceError(
      "Budget already exists for this category and fiscal year",
      409
    );
  }

  const category = await prisma.budgetCategory.findFirst({
    where: {
      id: data.categoryId,
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
  });
  if (!category) throw new FinanceError("Budget category not found", 404);

  const budget = await prisma.annualBudget.create({
    data: {
      categoryId: data.categoryId,
      fiscalYear: data.fiscalYear,
      allocatedAmount: new Prisma.Decimal(data.allocatedAmount),
      spentAmount: new Prisma.Decimal(0),
      remainingAmount: new Prisma.Decimal(data.allocatedAmount),
      notes: data.notes?.trim(),
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
    include: { category: true },
  });

  logger.info(`Annual budget created: ${category.name} ${data.fiscalYear}`);
  return budget;
}

async function updateAnnualBudget(
  id: string,
  data: { allocatedAmount?: number; status?: string; notes?: string },
  organizationId?: string
) {
  const existing = await prisma.annualBudget.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
  if (!existing) throw new FinanceError("Budget not found", 404);

  const updateData: Prisma.AnnualBudgetUpdateInput = {};

  if (data.allocatedAmount !== undefined) {
    const allocated = new Prisma.Decimal(data.allocatedAmount);
    const spent = existing.spentAmount;
    updateData.allocatedAmount = allocated;
    updateData.remainingAmount = allocated.minus(spent);
  }
  if (data.status) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes?.trim();

  return prisma.annualBudget.update({
    where: { id },
    data: updateData,
    include: { category: true },
  });
}

async function getBudgetSummary(fiscalYear?: number, organizationId?: string) {
  const year = fiscalYear || new Date().getFullYear();

  // Auto-create a zero-allocated AnnualBudget for any BudgetCategory that
  // doesn't yet have one this fiscal year. Keeps the Finance page consistent
  // across orgs — every category shows up in the summary even before the
  // admin has set its allocation.
  if (organizationId) {
    const [allCats, existing] = await Promise.all([
      prisma.budgetCategory.findMany({ where: { organizationId, isActive: true }, select: { id: true } }),
      prisma.annualBudget.findMany({ where: { organizationId, fiscalYear: year }, select: { categoryId: true } }),
    ]);
    const have = new Set(existing.map((b) => b.categoryId));
    const missing = allCats.filter((c) => !have.has(c.id));
    if (missing.length > 0) {
      await prisma.annualBudget.createMany({
        data: missing.map((c) => ({
          organizationId,
          fiscalYear: year,
          categoryId: c.id,
          allocatedAmount: new Prisma.Decimal(0),
          spentAmount: new Prisma.Decimal(0),
          remainingAmount: new Prisma.Decimal(0),
        })),
        skipDuplicates: true,
      });
    }
  }

  const budgets = await prisma.annualBudget.findMany({
    where: {
      fiscalYear: year,
      ...(organizationId ? { organizationId } : {}),
    },
    include: { category: true },
  });

  const totalAllocated = budgets.reduce(
    (sum, b) => sum + Number(b.allocatedAmount),
    0
  );
  const totalSpent = budgets.reduce(
    (sum, b) => sum + Number(b.spentAmount),
    0
  );
  const totalRemaining = budgets.reduce(
    (sum, b) => sum + Number(b.remainingAmount),
    0
  );

  const utilizationRate = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

  const byCategory = budgets.map((b) => ({
    category: b.category.name,
    categoryType: b.category.type,
    allocated: Number(b.allocatedAmount),
    spent: Number(b.spentAmount),
    remaining: Number(b.remainingAmount),
    utilization: Number(b.allocatedAmount) > 0
      ? (Number(b.spentAmount) / Number(b.allocatedAmount)) * 100
      : 0,
  }));

  return {
    fiscalYear: year,
    totalAllocated,
    totalSpent,
    totalRemaining,
    utilizationRate: Math.round(utilizationRate * 100) / 100,
    categoryCount: budgets.length,
    byCategory,
  };
}

// ─── TRANSACTIONS ──────────────────────────────────────────

async function getTransactions(filters: {
  page: number;
  limit: number;
  skip: number;
  type?: string;
  category?: string;
  costCenterId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  organizationId?: string;
}) {
  const where: Prisma.TransactionWhereInput = {};

  if (filters.type) where.type = filters.type;
  if (filters.category) where.category = { contains: filters.category, mode: "insensitive" };
  if (filters.costCenterId) where.costCenterId = filters.costCenterId;
  if (filters.status) where.status = filters.status;
  if (filters.organizationId) where.organizationId = filters.organizationId;
  if (filters.search) {
    where.OR = [
      { description: { contains: filters.search, mode: "insensitive" } },
      { reference: { contains: filters.search, mode: "insensitive" } },
      { category: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.startDate || filters.endDate) {
    where.transactionDate = {};
    if (filters.startDate) where.transactionDate.gte = new Date(filters.startDate);
    if (filters.endDate) where.transactionDate.lte = new Date(filters.endDate);
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.amount = {};
    if (filters.minAmount !== undefined) where.amount.gte = new Prisma.Decimal(filters.minAmount);
    if (filters.maxAmount !== undefined) where.amount.lte = new Prisma.Decimal(filters.maxAmount);
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        costCenter: { select: { id: true, name: true, code: true } },
      },
      orderBy: { transactionDate: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total };
}

async function getTransactionById(id: string, organizationId?: string) {
  return prisma.transaction.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
    include: { costCenter: true },
  });
}

async function createTransaction(data: {
  type: string;
  category: string;
  amount: number;
  currency?: string;
  description?: string;
  reference?: string;
  costCenterId?: string;
  transactionDate: string;
  createdBy?: string;
  organizationId?: string | null;
}) {
  const transaction = await prisma.transaction.create({
    data: {
      type: data.type,
      category: data.category.trim(),
      amount: new Prisma.Decimal(data.amount),
      currency: data.currency || "USD",
      description: data.description?.trim(),
      reference: data.reference?.trim(),
      costCenterId: data.costCenterId,
      transactionDate: new Date(data.transactionDate),
      createdBy: data.createdBy,
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
    include: { costCenter: { select: { id: true, name: true, code: true } } },
  });

  // Update budget spent amount if applicable
  const year = new Date(data.transactionDate).getFullYear();
  if (data.type === "expense") {
    const budgets = await prisma.annualBudget.findMany({
      where: {
        fiscalYear: year,
        ...(data.organizationId ? { organizationId: data.organizationId } : {}),
        category: { name: { equals: data.category, mode: "insensitive" } },
      },
    });

    for (const budget of budgets) {
      const currentSpent = new Prisma.Decimal(budget.spentAmount.toString());
      const allocated = new Prisma.Decimal(budget.allocatedAmount.toString());
      const newSpent = currentSpent.add(new Prisma.Decimal(data.amount));
      await prisma.annualBudget.update({
        where: { id: budget.id },
        data: {
          spentAmount: newSpent,
          remainingAmount: allocated.minus(newSpent),
        },
      });
    }
  }

  logger.info(`Transaction created: ${data.type} - ${data.amount} ${data.currency || "USD"}`);
  return transaction;
}

async function updateTransaction(
  id: string,
  data: {
    type?: string;
    category?: string;
    amount?: number;
    description?: string;
    reference?: string;
    costCenterId?: string;
    status?: string;
  },
  organizationId?: string
) {
  const existing = await prisma.transaction.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
  if (!existing) throw new FinanceError("Transaction not found", 404);

  return prisma.transaction.update({
    where: { id },
    data: {
      ...(data.type && { type: data.type }),
      ...(data.category && { category: data.category.trim() }),
      ...(data.amount !== undefined && { amount: new Prisma.Decimal(data.amount) }),
      ...(data.description !== undefined && { description: data.description?.trim() }),
      ...(data.reference !== undefined && { reference: data.reference?.trim() }),
      ...(data.costCenterId !== undefined && { costCenterId: data.costCenterId }),
      ...(data.status && { status: data.status }),
    },
    include: { costCenter: { select: { id: true, name: true, code: true } } },
  });
}

async function deleteTransaction(id: string, organizationId?: string) {
  const existing = await prisma.transaction.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
  if (!existing) throw new FinanceError("Transaction not found", 404);

  await prisma.transaction.delete({ where: { id } });
  logger.info(`Transaction deleted: ${id}`);
}

async function getTransactionStats(
  startDate?: string,
  endDate?: string,
  organizationId?: string
) {
  const where: Prisma.TransactionWhereInput = { status: "completed" };
  if (organizationId) where.organizationId = organizationId;

  if (startDate || endDate) {
    where.transactionDate = {};
    if (startDate) where.transactionDate.gte = new Date(startDate);
    if (endDate) where.transactionDate.lte = new Date(endDate);
  }

  const [income, expenses, byCategory, monthlyTrend] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...where, type: "income" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: "expense" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.groupBy({
      by: ["category", "type"],
      where,
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where,
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const totalIncome = Number(income._sum.amount || 0);
  const totalExpenses = Number(expenses._sum.amount || 0);

  return {
    totalIncome,
    totalExpenses,
    netIncome: totalIncome - totalExpenses,
    incomeCount: income._count,
    expenseCount: expenses._count,
    byCategory: byCategory.map((item) => ({
      category: item.category,
      type: item.type,
      total: Number(item._sum.amount || 0),
      count: item._count,
    })),
  };
}

// ─── FINANCIAL REPORTS ─────────────────────────────────────

async function getFinancialReports(filters: {
  page: number;
  limit: number;
  skip: number;
  type?: string;
  status?: string;
  organizationId?: string;
}) {
  const where: Prisma.FinancialReportWhereInput = {};
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.organizationId) where.organizationId = filters.organizationId;

  const [reports, total] = await Promise.all([
    prisma.financialReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.financialReport.count({ where }),
  ]);

  return { reports, total };
}

async function getFinancialReportById(id: string, organizationId?: string) {
  return prisma.financialReport.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
}

async function generateFinancialReport(data: {
  name: string;
  type: string;
  periodStart: string;
  periodEnd: string;
  generatedBy?: string;
  organizationId?: string | null;
}) {
  const start = new Date(data.periodStart);
  const end = new Date(data.periodEnd);

  const transactions = await prisma.transaction.findMany({
    where: {
      transactionDate: { gte: start, lte: end },
      status: "completed",
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
    include: { costCenter: true },
  });

  const incomeTotal = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const expenseTotal = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const incomeByCategory: Record<string, number> = {};
  const expenseByCategory: Record<string, number> = {};

  transactions.forEach((t) => {
    const target = t.type === "income" ? incomeByCategory : expenseByCategory;
    target[t.category] = (target[t.category] || 0) + Number(t.amount);
  });

  const reportData = {
    period: { start: data.periodStart, end: data.periodEnd },
    summary: {
      totalIncome: incomeTotal,
      totalExpenses: expenseTotal,
      netIncome: incomeTotal - expenseTotal,
      transactionCount: transactions.length,
    },
    incomeByCategory,
    expenseByCategory,
    generatedAt: new Date().toISOString(),
  };

  const report = await prisma.financialReport.create({
    data: {
      name: data.name.trim(),
      type: data.type,
      periodStart: start,
      periodEnd: end,
      data: reportData as Prisma.InputJsonValue,
      generatedBy: data.generatedBy,
      status: "final",
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
  });

  logger.info(`Financial report generated: ${report.name}`);
  return report;
}

// ─── COST CENTERS ──────────────────────────────────────────

const DEFAULT_COST_CENTERS = [
  { name: "Engineering", code: "CC-ENG", limit: 600000 },
  { name: "Sales", code: "CC-SAL", limit: 450000 },
  { name: "Marketing", code: "CC-MKT", limit: 300000 },
  { name: "Operations", code: "CC-OPS", limit: 200000 },
  { name: "HR & Admin", code: "CC-HR", limit: 150000 },
];

async function getCostCenters(filters: {
  isActive?: boolean;
  departmentId?: string;
  organizationId?: string;
}) {
  // Auto-seed default cost centers for any org that has none yet so the
  // Finance admin page is never empty after a fresh org create.
  if (filters.organizationId) {
    const count = await prisma.costCenter.count({ where: { organizationId: filters.organizationId } });
    if (count === 0) {
      for (const cc of DEFAULT_COST_CENTERS) {
        try {
          await prisma.costCenter.create({
            data: {
              organizationId: filters.organizationId,
              name: cc.name,
              code: cc.code,
              budgetLimit: new Prisma.Decimal(cc.limit),
              isActive: true,
            },
          });
        } catch { /* unique-constraint race — ignore */ }
      }
    }
  }

  const where: Prisma.CostCenterWhereInput = {};
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.organizationId) where.organizationId = filters.organizationId;

  return prisma.costCenter.findMany({
    where,
    include: {
      department: { select: { id: true, name: true } },
      _count: { select: { transactions: true } },
    },
    orderBy: { name: "asc" },
  });
}

async function createCostCenter(data: {
  name: string;
  code: string;
  departmentId?: string;
  budgetLimit?: number;
  organizationId?: string | null;
}) {
  const costCenter = await prisma.costCenter.create({
    data: {
      name: data.name.trim(),
      code: data.code.toUpperCase().trim(),
      departmentId: data.departmentId,
      budgetLimit: data.budgetLimit !== undefined
        ? new Prisma.Decimal(data.budgetLimit)
        : undefined,
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
    include: { department: { select: { id: true, name: true } } },
  });

  logger.info(`Cost center created: ${costCenter.name}`);
  return costCenter;
}

async function updateCostCenter(
  id: string,
  data: { name?: string; departmentId?: string; budgetLimit?: number; isActive?: boolean },
  organizationId?: string
) {
  if (organizationId) {
    const owned = await prisma.costCenter.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new FinanceError("Cost center not found", 404);
  }
  return prisma.costCenter.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.departmentId !== undefined && { departmentId: data.departmentId }),
      ...(data.budgetLimit !== undefined && { budgetLimit: new Prisma.Decimal(data.budgetLimit) }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    include: { department: { select: { id: true, name: true } } },
  });
}

async function deleteCostCenter(id: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.costCenter.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new FinanceError("Cost center not found", 404);
  }
  const txCount = await prisma.transaction.count({ where: { costCenterId: id } });
  if (txCount > 0) {
    throw new FinanceError(
      `Cannot delete cost center with ${txCount} transaction(s). Deactivate instead.`,
      400
    );
  }
  await prisma.costCenter.delete({ where: { id } });
  logger.info(`Cost center deleted: ${id}`);
}

// ─── VARIANCE ANALYSIS ────────────────────────────────────

async function getVarianceAnalysis(fiscalYear?: number, organizationId?: string) {
  const year = fiscalYear || new Date().getFullYear();

  const budgets = await prisma.annualBudget.findMany({
    where: {
      fiscalYear: year,
      ...(organizationId ? { organizationId } : {}),
    },
    include: { category: true },
  });

  const analysis = budgets.map((b) => {
    const allocated = Number(b.allocatedAmount);
    const spent = Number(b.spentAmount);
    const variance = allocated - spent;
    const variancePercent = allocated > 0 ? (variance / allocated) * 100 : 0;

    let status: string;
    if (variancePercent > 20) status = "under_budget";
    else if (variancePercent > 0) status = "on_track";
    else if (variancePercent > -10) status = "warning";
    else status = "over_budget";

    return {
      category: b.category.name,
      categoryType: b.category.type,
      allocated,
      spent,
      variance,
      variancePercent: Math.round(variancePercent * 100) / 100,
      status,
    };
  });

  const overBudgetCount = analysis.filter((a) => a.status === "over_budget").length;
  const warningCount = analysis.filter((a) => a.status === "warning").length;

  return {
    fiscalYear: year,
    categories: analysis,
    summary: {
      totalCategories: analysis.length,
      overBudget: overBudgetCount,
      warning: warningCount,
      onTrack: analysis.length - overBudgetCount - warningCount,
    },
  };
}

export class FinanceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "FinanceError";
    this.statusCode = statusCode;
  }
}

const financeService = {
  getBudgetCategories,
  createBudgetCategory,
  updateBudgetCategory,
  getAnnualBudgets,
  getAnnualBudgetById,
  createAnnualBudget,
  updateAnnualBudget,
  getBudgetSummary,
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionStats,
  getFinancialReports,
  getFinancialReportById,
  generateFinancialReport,
  getCostCenters,
  createCostCenter,
  updateCostCenter,
  deleteCostCenter,
  getVarianceAnalysis,
};

export default financeService;
