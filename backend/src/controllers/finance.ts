import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import financeService, { FinanceError } from "../services/finance";
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound,
  sendBadRequest,
  parsePagination,
} from "../utils/response";
import logger from "../utils/logger";

// ─── BUDGET CATEGORIES ─────────────────────────────────────

async function getBudgetCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { isActive, type } = req.query;
    const categories = await financeService.getBudgetCategories({
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      type: type as string,
    });
    sendSuccess(res, categories, "Budget categories retrieved");
  } catch (error) {
    logger.error("Get budget categories error:", error);
    sendError(res, "Failed to retrieve budget categories");
  }
}

async function createBudgetCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, code, type, description } = req.body;
    if (!name || !code || !type) {
      sendBadRequest(res, "Name, code, and type are required");
      return;
    }
    if (!["revenue", "expense", "capital"].includes(type)) {
      sendBadRequest(res, "Type must be: revenue, expense, or capital");
      return;
    }
    const category = await financeService.createBudgetCategory({ name, code, type, description });
    sendCreated(res, category, "Budget category created");
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      sendError(res, "Budget category name or code already exists", 409);
      return;
    }
    logger.error("Create budget category error:", error);
    sendError(res, "Failed to create budget category");
  }
}

async function updateBudgetCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const category = await financeService.updateBudgetCategory(req.params.id, req.body);
    sendSuccess(res, category, "Budget category updated");
  } catch (error) {
    logger.error("Update budget category error:", error);
    sendError(res, "Failed to update budget category");
  }
}

// ─── ANNUAL BUDGETS ────────────────────────────────────────

async function getAnnualBudgets(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { fiscalYear, categoryId, status } = req.query;

    const result = await financeService.getAnnualBudgets({
      page, limit, skip,
      fiscalYear: fiscalYear ? parseInt(fiscalYear as string, 10) : undefined,
      categoryId: categoryId as string,
      status: status as string,
    });

    sendPaginated(res, result.budgets, result.total, page, limit, "Annual budgets retrieved");
  } catch (error) {
    logger.error("Get annual budgets error:", error);
    sendError(res, "Failed to retrieve annual budgets");
  }
}

async function getAnnualBudgetById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const budget = await financeService.getAnnualBudgetById(req.params.id);
    if (!budget) { sendNotFound(res, "Annual budget"); return; }
    sendSuccess(res, budget, "Annual budget retrieved");
  } catch (error) {
    logger.error("Get annual budget error:", error);
    sendError(res, "Failed to retrieve annual budget");
  }
}

async function createAnnualBudget(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { categoryId, fiscalYear, allocatedAmount, notes } = req.body;
    if (!categoryId || !fiscalYear || allocatedAmount === undefined) {
      sendBadRequest(res, "Category ID, fiscal year, and allocated amount are required");
      return;
    }
    const budget = await financeService.createAnnualBudget({
      categoryId, fiscalYear: Number(fiscalYear),
      allocatedAmount: Number(allocatedAmount), notes,
    });
    sendCreated(res, budget, "Annual budget created");
  } catch (error) {
    if (error instanceof FinanceError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create annual budget error:", error);
    sendError(res, "Failed to create annual budget");
  }
}

async function updateAnnualBudget(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const budget = await financeService.updateAnnualBudget(req.params.id, {
      ...req.body,
      allocatedAmount: req.body.allocatedAmount !== undefined ? Number(req.body.allocatedAmount) : undefined,
    });
    sendSuccess(res, budget, "Annual budget updated");
  } catch (error) {
    if (error instanceof FinanceError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update annual budget error:", error);
    sendError(res, "Failed to update annual budget");
  }
}

async function getBudgetSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { fiscalYear } = req.query;
    const summary = await financeService.getBudgetSummary(
      fiscalYear ? parseInt(fiscalYear as string, 10) : undefined
    );
    sendSuccess(res, summary, "Budget summary retrieved");
  } catch (error) {
    logger.error("Budget summary error:", error);
    sendError(res, "Failed to retrieve budget summary");
  }
}

// ─── TRANSACTIONS ──────────────────────────────────────────

async function getTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { type, category, costCenterId, status, startDate, endDate, search, minAmount, maxAmount } = req.query;

    const result = await financeService.getTransactions({
      page, limit, skip,
      type: type as string,
      category: category as string,
      costCenterId: costCenterId as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      search: search as string,
      minAmount: minAmount ? Number(minAmount) : undefined,
      maxAmount: maxAmount ? Number(maxAmount) : undefined,
    });

    sendPaginated(res, result.transactions, result.total, page, limit, "Transactions retrieved");
  } catch (error) {
    logger.error("Get transactions error:", error);
    sendError(res, "Failed to retrieve transactions");
  }
}

async function getTransactionById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const transaction = await financeService.getTransactionById(req.params.id);
    if (!transaction) { sendNotFound(res, "Transaction"); return; }
    sendSuccess(res, transaction, "Transaction retrieved");
  } catch (error) {
    logger.error("Get transaction error:", error);
    sendError(res, "Failed to retrieve transaction");
  }
}

async function createTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { type, category, amount, currency, description, reference, costCenterId, transactionDate } = req.body;
    if (!type || !category || amount === undefined || !transactionDate) {
      sendBadRequest(res, "Type, category, amount, and transaction date are required");
      return;
    }
    if (!["income", "expense", "transfer"].includes(type)) {
      sendBadRequest(res, "Type must be: income, expense, or transfer");
      return;
    }

    const transaction = await financeService.createTransaction({
      type, category, amount: Number(amount), currency, description,
      reference, costCenterId, transactionDate,
      createdBy: req.user?.userId,
    });
    sendCreated(res, transaction, "Transaction created");
  } catch (error) {
    if (error instanceof FinanceError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create transaction error:", error);
    sendError(res, "Failed to create transaction");
  }
}

async function updateTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const transaction = await financeService.updateTransaction(req.params.id, {
      ...req.body,
      amount: req.body.amount !== undefined ? Number(req.body.amount) : undefined,
    });
    sendSuccess(res, transaction, "Transaction updated");
  } catch (error) {
    if (error instanceof FinanceError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update transaction error:", error);
    sendError(res, "Failed to update transaction");
  }
}

async function deleteTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await financeService.deleteTransaction(req.params.id);
    sendSuccess(res, null, "Transaction deleted");
  } catch (error) {
    if (error instanceof FinanceError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete transaction error:", error);
    sendError(res, "Failed to delete transaction");
  }
}

async function getTransactionStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { startDate, endDate } = req.query;
    const stats = await financeService.getTransactionStats(
      startDate as string, endDate as string
    );
    sendSuccess(res, stats, "Transaction statistics retrieved");
  } catch (error) {
    logger.error("Transaction stats error:", error);
    sendError(res, "Failed to retrieve transaction statistics");
  }
}

// ─── FINANCIAL REPORTS ─────────────────────────────────────

async function getFinancialReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { type, status } = req.query;

    const result = await financeService.getFinancialReports({
      page, limit, skip,
      type: type as string,
      status: status as string,
    });

    sendPaginated(res, result.reports, result.total, page, limit, "Financial reports retrieved");
  } catch (error) {
    logger.error("Get financial reports error:", error);
    sendError(res, "Failed to retrieve financial reports");
  }
}

async function getFinancialReportById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const report = await financeService.getFinancialReportById(req.params.id);
    if (!report) { sendNotFound(res, "Financial report"); return; }
    sendSuccess(res, report, "Financial report retrieved");
  } catch (error) {
    logger.error("Get financial report error:", error);
    sendError(res, "Failed to retrieve financial report");
  }
}

async function generateFinancialReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, type, periodStart, periodEnd } = req.body;
    if (!name || !type || !periodStart || !periodEnd) {
      sendBadRequest(res, "Name, type, period start, and period end are required");
      return;
    }
    const report = await financeService.generateFinancialReport({
      name, type, periodStart, periodEnd,
      generatedBy: req.user?.userId,
    });
    sendCreated(res, report, "Financial report generated");
  } catch (error) {
    logger.error("Generate financial report error:", error);
    sendError(res, "Failed to generate financial report");
  }
}

// ─── COST CENTERS ──────────────────────────────────────────

async function getCostCenters(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { isActive, departmentId } = req.query;
    const centers = await financeService.getCostCenters({
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      departmentId: departmentId as string,
    });
    sendSuccess(res, centers, "Cost centers retrieved");
  } catch (error) {
    logger.error("Get cost centers error:", error);
    sendError(res, "Failed to retrieve cost centers");
  }
}

async function createCostCenter(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, code, departmentId, budgetLimit } = req.body;
    if (!name || !code) { sendBadRequest(res, "Name and code are required"); return; }
    const center = await financeService.createCostCenter({
      name, code, departmentId,
      budgetLimit: budgetLimit !== undefined ? Number(budgetLimit) : undefined,
    });
    sendCreated(res, center, "Cost center created");
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      sendError(res, "Cost center name or code already exists", 409);
      return;
    }
    logger.error("Create cost center error:", error);
    sendError(res, "Failed to create cost center");
  }
}

async function updateCostCenter(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const center = await financeService.updateCostCenter(req.params.id, {
      ...req.body,
      budgetLimit: req.body.budgetLimit !== undefined ? Number(req.body.budgetLimit) : undefined,
    });
    sendSuccess(res, center, "Cost center updated");
  } catch (error) {
    logger.error("Update cost center error:", error);
    sendError(res, "Failed to update cost center");
  }
}

async function deleteCostCenter(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await financeService.deleteCostCenter(req.params.id);
    sendSuccess(res, null, "Cost center deleted");
  } catch (error) {
    if (error instanceof FinanceError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete cost center error:", error);
    sendError(res, "Failed to delete cost center");
  }
}

// ─── VARIANCE ANALYSIS ────────────────────────────────────

async function getVarianceAnalysis(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { fiscalYear } = req.query;
    const analysis = await financeService.getVarianceAnalysis(
      fiscalYear ? parseInt(fiscalYear as string, 10) : undefined
    );
    sendSuccess(res, analysis, "Variance analysis retrieved");
  } catch (error) {
    logger.error("Variance analysis error:", error);
    sendError(res, "Failed to retrieve variance analysis");
  }
}

const financeController = {
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

export default financeController;
