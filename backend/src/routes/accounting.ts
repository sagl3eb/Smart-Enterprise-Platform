import { Router } from "express";
import accountingController from "../controllers/accounting";
import { authenticate } from "../middleware/auth";
import { attachScope } from "../middleware/callerScope";
import { blockViewerWrites, blockSuperAdminModuleWrites } from "../middleware/rbac";

const router = Router();
router.use(authenticate);
router.use(attachScope);
router.use(blockViewerWrites);
router.use(blockSuperAdminModuleWrites);

router.get("/trial-balance", accountingController.getTrialBalance);

router.get("/accounts", accountingController.getChartOfAccounts);
router.get("/accounts/:id", accountingController.getAccountById);
router.post("/accounts", accountingController.createAccount);
router.put("/accounts/:id", accountingController.updateAccount);

router.get("/journal-entries", accountingController.getJournalEntries);
router.get("/journal-entries/:id", accountingController.getJournalEntryById);
router.post("/journal-entries", accountingController.createJournalEntry);
router.put("/journal-entries/:id/post", accountingController.postJournalEntry);
router.put("/journal-entries/:id/void", accountingController.voidJournalEntry);

router.get("/invoices", accountingController.getInvoices);
router.get("/invoices/summary", accountingController.getInvoiceSummary);
router.get("/invoices/:id", accountingController.getInvoiceById);
router.post("/invoices", accountingController.createInvoice);
router.put("/invoices/:id/status", accountingController.updateInvoiceStatus);

router.get("/payments", accountingController.getPayments);
router.post("/payments", accountingController.recordPayment);

router.get("/tax-records", accountingController.getTaxRecords);
router.post("/tax-records", accountingController.createTaxRecord);
router.put("/tax-records/:id", accountingController.updateTaxRecord);

export default router;
