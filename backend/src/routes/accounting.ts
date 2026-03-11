import { Router } from "express";
import accountingController from "../controllers/accounting";
import { authenticate } from "../middleware/auth";
import { requireRole, requireMinRole } from "../middleware/rbac";

const router = Router();
router.use(authenticate);

// ─── Trial Balance ─────────────────────────────────────────
router.get("/trial-balance", accountingController.getTrialBalance);

// ─── Chart of Accounts ─────────────────────────────────────
router.get("/accounts", accountingController.getChartOfAccounts);
router.get("/accounts/:id", accountingController.getAccountById);
router.post("/accounts", requireMinRole("manager"), accountingController.createAccount);
router.put("/accounts/:id", requireMinRole("manager"), accountingController.updateAccount);

// ─── Journal Entries ───────────────────────────────────────
router.get("/journal-entries", accountingController.getJournalEntries);
router.get("/journal-entries/:id", accountingController.getJournalEntryById);
router.post("/journal-entries", requireMinRole("manager"), accountingController.createJournalEntry);
router.put("/journal-entries/:id/post", requireMinRole("manager"), accountingController.postJournalEntry);
router.put("/journal-entries/:id/void", requireRole("admin"), accountingController.voidJournalEntry);

// ─── Invoices ──────────────────────────────────────────────
router.get("/invoices", accountingController.getInvoices);
router.get("/invoices/summary", accountingController.getInvoiceSummary);
router.get("/invoices/:id", accountingController.getInvoiceById);
router.post("/invoices", requireMinRole("employee"), accountingController.createInvoice);
router.put("/invoices/:id/status", requireMinRole("manager"), accountingController.updateInvoiceStatus);

// ─── Payments ──────────────────────────────────────────────
router.get("/payments", accountingController.getPayments);
router.post("/payments", requireMinRole("employee"), accountingController.recordPayment);

// ─── Tax Records ───────────────────────────────────────────
router.get("/tax-records", accountingController.getTaxRecords);
router.post("/tax-records", requireMinRole("manager"), accountingController.createTaxRecord);
router.put("/tax-records/:id", requireMinRole("manager"), accountingController.updateTaxRecord);

export default router;
