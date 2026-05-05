import { Router } from "express";
import financeController from "../controllers/finance";
import { authenticate } from "../middleware/auth";
import { attachScope } from "../middleware/callerScope";
import { blockViewerWrites, blockSuperAdminModuleWrites } from "../middleware/rbac";

const router = Router();
router.use(authenticate);
router.use(attachScope);
router.use(blockViewerWrites);
router.use(blockSuperAdminModuleWrites);

router.get("/stats", financeController.getTransactionStats);
router.get("/variance-analysis", financeController.getVarianceAnalysis);

router.get("/budget-categories", financeController.getBudgetCategories);
router.post("/budget-categories", financeController.createBudgetCategory);
router.put("/budget-categories/:id", financeController.updateBudgetCategory);

router.get("/budgets", financeController.getAnnualBudgets);
router.get("/budgets/summary", financeController.getBudgetSummary);
router.get("/budgets/:id", financeController.getAnnualBudgetById);
router.post("/budgets", financeController.createAnnualBudget);
router.put("/budgets/:id", financeController.updateAnnualBudget);

router.get("/transactions", financeController.getTransactions);
router.get("/transactions/:id", financeController.getTransactionById);
router.post("/transactions", financeController.createTransaction);
router.put("/transactions/:id", financeController.updateTransaction);
router.delete("/transactions/:id", financeController.deleteTransaction);

router.get("/reports", financeController.getFinancialReports);
router.get("/reports/:id", financeController.getFinancialReportById);
router.post("/reports/generate", financeController.generateFinancialReport);

router.get("/cost-centers", financeController.getCostCenters);
router.post("/cost-centers", financeController.createCostCenter);
router.put("/cost-centers/:id", financeController.updateCostCenter);
router.delete("/cost-centers/:id", financeController.deleteCostCenter);

export default router;
