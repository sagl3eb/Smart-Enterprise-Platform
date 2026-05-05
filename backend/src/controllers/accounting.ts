import { Response } from "express";
import { ScopedRequest, readOrgFilter, writeOrgId } from "../middleware/callerScope";
import accountingService, { AccountingError } from "../services/accounting";
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

// ─── CHART OF ACCOUNTS ─────────────────────────────────────

async function getChartOfAccounts(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { type, isActive, search } = req.query;
    const accounts = await accountingService.getChartOfAccounts({
      type: type as string,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      search: search as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });
    sendSuccess(res, accounts, "Chart of accounts retrieved");
  } catch (error) {
    logger.error("Get chart of accounts error:", error);
    sendError(res, "Failed to retrieve chart of accounts");
  }
}

async function getAccountById(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const account = await accountingService.getAccountById(req.params.id, orgFilter);
    if (!account) { sendNotFound(res, "Account"); return; }
    sendSuccess(res, account, "Account retrieved");
  } catch (error) {
    logger.error("Get account error:", error);
    sendError(res, "Failed to retrieve account");
  }
}

async function createAccount(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { accountCode, name, type, parentId, description, organizationId: bodyOrgId } = req.body;
    if (!accountCode || !name || !type) {
      sendBadRequest(res, "Account code, name, and type are required");
      return;
    }
    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;
    const account = await accountingService.createAccount({
      accountCode, name, type, parentId, description,
      organizationId: orgId,
    });
    sendCreated(res, account, "Account created");
  } catch (error) {
    if (error instanceof AccountingError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create account error:", error);
    sendError(res, "Failed to create account");
  }
}

async function updateAccount(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const account = await accountingService.updateAccount(req.params.id, req.body, orgFilter);
    sendSuccess(res, account, "Account updated");
  } catch (error) {
    if (error instanceof AccountingError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update account error:", error);
    sendError(res, "Failed to update account");
  }
}

// ─── JOURNAL ENTRIES ───────────────────────────────────────

async function getJournalEntries(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { status, startDate, endDate, search } = req.query;

    const result = await accountingService.getJournalEntries({
      page, limit, skip,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      search: search as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });

    sendPaginated(res, result.entries, result.total, page, limit, "Journal entries retrieved");
  } catch (error) {
    logger.error("Get journal entries error:", error);
    sendError(res, "Failed to retrieve journal entries");
  }
}

async function getJournalEntryById(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const entry = await accountingService.getJournalEntryById(req.params.id, orgFilter);
    if (!entry) { sendNotFound(res, "Journal entry"); return; }
    sendSuccess(res, entry, "Journal entry retrieved");
  } catch (error) {
    logger.error("Get journal entry error:", error);
    sendError(res, "Failed to retrieve journal entry");
  }
}

async function createJournalEntry(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { entryNumber, date, description, reference, lines, organizationId: bodyOrgId } = req.body;
    if (!entryNumber || !date || !lines) {
      sendBadRequest(res, "Entry number, date, and lines are required");
      return;
    }
    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;
    const entry = await accountingService.createJournalEntry({
      entryNumber, date, description, reference,
      createdBy: req.user?.userId,
      organizationId: orgId,
      lines: lines.map((l: { accountId: string; debit: number; credit: number; description?: string }) => ({
        accountId: l.accountId,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        description: l.description,
      })),
    });
    sendCreated(res, entry, "Journal entry created");
  } catch (error) {
    if (error instanceof AccountingError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create journal entry error:", error);
    sendError(res, "Failed to create journal entry");
  }
}

async function postJournalEntry(req: ScopedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { sendError(res, "Unauthorized", 401); return; }
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const entry = await accountingService.postJournalEntry(req.params.id, req.user.userId, orgFilter);
    sendSuccess(res, entry, "Journal entry posted");
  } catch (error) {
    if (error instanceof AccountingError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Post journal entry error:", error);
    sendError(res, "Failed to post journal entry");
  }
}

async function voidJournalEntry(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const entry = await accountingService.voidJournalEntry(req.params.id, orgFilter);
    sendSuccess(res, entry, "Journal entry voided");
  } catch (error) {
    if (error instanceof AccountingError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Void journal entry error:", error);
    sendError(res, "Failed to void journal entry");
  }
}

// ─── INVOICES ──────────────────────────────────────────────

async function getInvoices(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { type, status, search, startDate, endDate } = req.query;

    const result = await accountingService.getInvoices({
      page, limit, skip,
      type: type as string,
      status: status as string,
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });

    sendPaginated(res, result.invoices, result.total, page, limit, "Invoices retrieved");
  } catch (error) {
    logger.error("Get invoices error:", error);
    sendError(res, "Failed to retrieve invoices");
  }
}

async function getInvoiceById(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const invoice = await accountingService.getInvoiceById(req.params.id, orgFilter);
    if (!invoice) { sendNotFound(res, "Invoice"); return; }
    sendSuccess(res, invoice, "Invoice retrieved");
  } catch (error) {
    logger.error("Get invoice error:", error);
    sendError(res, "Failed to retrieve invoice");
  }
}

async function createInvoice(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { invoiceNumber, type, clientName, clientEmail, issueDate, dueDate, notes, lineItems, budgetCategoryId, status, organizationId: bodyOrgId } = req.body;
    if (!invoiceNumber || !type || !clientName || !issueDate || !dueDate || !lineItems) {
      sendBadRequest(res, "Required: invoiceNumber, type, clientName, issueDate, dueDate, lineItems");
      return;
    }
    if (!["sales", "purchase"].includes(type)) {
      sendBadRequest(res, "Type must be: sales or purchase");
      return;
    }
    if (!budgetCategoryId) {
      sendBadRequest(res, "A budget category is required for every invoice");
      return;
    }
    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;
    const invoice = await accountingService.createInvoice({
      invoiceNumber, type, clientName, clientEmail, issueDate, dueDate, notes, budgetCategoryId, status,
      createdBy: req.user?.userId,
      organizationId: orgId,
      lineItems: lineItems.map((item: { description: string; quantity: number; unitPrice: number; taxRate?: number }) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: item.taxRate !== undefined ? Number(item.taxRate) : 0,
      })),
    });
    sendCreated(res, invoice, "Invoice created");
  } catch (error) {
    if (error instanceof AccountingError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create invoice error:", error);
    sendError(res, "Failed to create invoice");
  }
}

async function updateInvoiceStatus(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (!status) { sendBadRequest(res, "Status is required"); return; }
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const invoice = await accountingService.updateInvoiceStatus(req.params.id, status, orgFilter);
    sendSuccess(res, invoice, "Invoice status updated");
  } catch (error) {
    if (error instanceof AccountingError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update invoice status error:", error);
    sendError(res, "Failed to update invoice status");
  }
}

async function getInvoiceSummary(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const summary = await accountingService.getInvoiceSummary(orgFilter);
    sendSuccess(res, summary, "Invoice summary retrieved");
  } catch (error) {
    logger.error("Invoice summary error:", error);
    sendError(res, "Failed to retrieve invoice summary");
  }
}

// ─── PAYMENTS ──────────────────────────────────────────────

async function getPayments(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { invoiceId, status, startDate, endDate } = req.query;

    const result = await accountingService.getPayments({
      page, limit, skip,
      invoiceId: invoiceId as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });

    sendPaginated(res, result.payments, result.total, page, limit, "Payments retrieved");
  } catch (error) {
    logger.error("Get payments error:", error);
    sendError(res, "Failed to retrieve payments");
  }
}

async function recordPayment(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { invoiceId, amount, paymentDate, paymentMethod, reference, notes, budgetCategoryId, organizationId: bodyOrgId } = req.body;
    if (amount === undefined || !paymentDate || !paymentMethod) {
      sendBadRequest(res, "Amount, payment date, and payment method are required");
      return;
    }
    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;
    const payment = await accountingService.recordPayment({
      invoiceId, amount: Number(amount), paymentDate, paymentMethod, reference, notes, budgetCategoryId,
      organizationId: orgId,
    });
    sendCreated(res, payment, "Payment recorded and budget updated");
  } catch (error) {
    if (error instanceof AccountingError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Record payment error:", error);
    sendError(res, "Failed to record payment");
  }
}

// ─── TAX RECORDS ───────────────────────────────────────────

async function getTaxRecords(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { taxType, status, period } = req.query;

    const result = await accountingService.getTaxRecords({
      page, limit, skip,
      taxType: taxType as string,
      status: status as string,
      period: period as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });

    sendPaginated(res, result.records, result.total, page, limit, "Tax records retrieved");
  } catch (error) {
    logger.error("Get tax records error:", error);
    sendError(res, "Failed to retrieve tax records");
  }
}

async function createTaxRecord(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { taxType, period, taxableAmount, taxAmount, dueDate, filingDate, notes, organizationId: bodyOrgId } = req.body;
    if (!taxType || !period || taxableAmount === undefined || taxAmount === undefined || !dueDate) {
      sendBadRequest(res, "Required: taxType, period, taxableAmount, taxAmount, dueDate");
      return;
    }
    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;
    const record = await accountingService.createTaxRecord({
      taxType, period,
      taxableAmount: Number(taxableAmount),
      taxAmount: Number(taxAmount),
      dueDate, filingDate, notes,
      organizationId: orgId,
    });
    sendCreated(res, record, "Tax record created");
  } catch (error) {
    logger.error("Create tax record error:", error);
    sendError(res, "Failed to create tax record");
  }
}

async function updateTaxRecord(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const record = await accountingService.updateTaxRecord(req.params.id, req.body, orgFilter);
    sendSuccess(res, record, "Tax record updated");
  } catch (error) {
    if (error instanceof AccountingError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update tax record error:", error);
    sendError(res, "Failed to update tax record");
  }
}

// ─── TRIAL BALANCE ─────────────────────────────────────────

async function getTrialBalance(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const orgFilter = req.scope ? readOrgFilter(req.scope) : undefined;
    const trialBalance = await accountingService.getTrialBalance(orgFilter);
    sendSuccess(res, trialBalance, "Trial balance retrieved");
  } catch (error) {
    logger.error("Trial balance error:", error);
    sendError(res, "Failed to retrieve trial balance");
  }
}

const accountingController = {
  getChartOfAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  getJournalEntries,
  getJournalEntryById,
  createJournalEntry,
  postJournalEntry,
  voidJournalEntry,
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoiceStatus,
  getInvoiceSummary,
  getPayments,
  recordPayment,
  getTaxRecords,
  createTaxRecord,
  updateTaxRecord,
  getTrialBalance,
};

export default accountingController;
