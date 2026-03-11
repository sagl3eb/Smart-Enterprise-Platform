import { Router } from "express";
import financeController from "../controllers/finance";
import { authenticate } from "../middleware/auth";
import { requireRole, requireMinRole } from "../middleware/rbac";

const router = Router();
router.use(authenticate);

// ─── Stats & Analysis ──────────────────────────────────────
router.get("/stats", financeController.getTransactionStats);
router.get("/variance-analysis", financeController.getVarianceAnalysis);

// ─── Budget Categories ─────────────────────────────────────
router.get("/budget-categories", financeController.getBudgetCategories);
router.post("/budget-categories", requireMinRole("manager"), financeController.createBudgetCategory);
router.put("/budget-categories/:id", requireMinRole("manager"), financeController.updateBudgetCategory);

// ─── Annual Budgets ────────────────────────────────────────
router.get("/budgets", financeController.getAnnualBudgets);
router.get("/budgets/summary", financeController.getBudgetSummary);
router.get("/budgets/:id", financeController.getAnnualBudgetById);
router.post("/budgets", requireMinRole("manager"), financeController.createAnnualBudget);
router.put("/budgets/:id", requireMinRole("manager"), financeController.updateAnnualBudget);

// ─── Transactions ──────────────────────────────────────────
router.get("/transactions", financeController.getTransactions);
router.get("/transactions/:id", financeController.getTransactionById);
router.post("/transactions", requireMinRole("employee"), financeController.createTransaction);
router.put("/transactions/:id", requireMinRole("manager"), financeController.updateTransaction);
router.delete("/transactions/:id", requireRole("admin"), financeController.deleteTransaction);

// ─── Financial Reports ─────────────────────────────────────
router.get("/reports", financeController.getFinancialReports);
router.get("/reports/:id", financeController.getFinancialReportById);
router.post("/reports/generate", requireMinRole("manager"), financeController.generateFinancialReport);

// ─── Cost Centers ──────────────────────────────────────────
router.get("/cost-centers", financeController.getCostCenters);
router.post("/cost-centers", requireMinRole("manager"), financeController.createCostCenter);
router.put("/cost-centers/:id", requireMinRole("manager"), financeController.updateCostCenter);
router.delete("/cost-centers/:id", requireRole("admin"), financeController.deleteCostCenter);

export default router;
