import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";

// ─── CHART OF ACCOUNTS ─────────────────────────────────────

async function getChartOfAccounts(filters: { type?: string; isActive?: boolean; search?: string }) {
  const where: Prisma.ChartOfAccountWhereInput = {};
  if (filters.type) where.type = filters.type;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { accountCode: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.chartOfAccount.findMany({
    where,
    include: {
      parent: { select: { id: true, accountCode: true, name: true } },
      children: { select: { id: true, accountCode: true, name: true, balance: true } },
    },
    orderBy: { accountCode: "asc" },
  });
}

async function getAccountById(id: string) {
  return prisma.chartOfAccount.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, accountCode: true, name: true } },
      children: { select: { id: true, accountCode: true, name: true, balance: true, type: true } },
      journalLines: {
        take: 20,
        orderBy: { journalEntry: { date: "desc" } },
        include: {
          journalEntry: { select: { id: true, entryNumber: true, date: true, description: true } },
        },
      },
    },
  });
}

async function createAccount(data: {
  accountCode: string;
  name: string;
  type: string;
  parentId?: string;
  description?: string;
}) {
  const existing = await prisma.chartOfAccount.findUnique({
    where: { accountCode: data.accountCode },
  });
  if (existing) throw new AccountingError("Account code already exists", 409);

  if (!["asset", "liability", "equity", "revenue", "expense"].includes(data.type)) {
    throw new AccountingError("Type must be: asset, liability, equity, revenue, or expense", 400);
  }

  const account = await prisma.chartOfAccount.create({
    data: {
      accountCode: data.accountCode.trim(),
      name: data.name.trim(),
      type: data.type,
      parentId: data.parentId,
      description: data.description?.trim(),
    },
    include: { parent: { select: { id: true, accountCode: true, name: true } } },
  });

  logger.info(`Account created: ${account.accountCode} - ${account.name}`);
  return account;
}

async function updateAccount(
  id: string,
  data: { name?: string; description?: string; isActive?: boolean }
) {
  return prisma.chartOfAccount.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

// ─── JOURNAL ENTRIES ───────────────────────────────────────

async function getJournalEntries(filters: {
  page: number;
  limit: number;
  skip: number;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  const where: Prisma.JournalEntryWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { entryNumber: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { reference: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate) where.date.gte = new Date(filters.startDate);
    if (filters.endDate) where.date.lte = new Date(filters.endDate);
  }

  const [entries, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: {
            account: { select: { id: true, accountCode: true, name: true, type: true } },
          },
        },
      },
      orderBy: { date: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.journalEntry.count({ where }),
  ]);

  return { entries, total };
}

async function getJournalEntryById(id: string) {
  return prisma.journalEntry.findUnique({
    where: { id },
    include: {
      lines: {
        include: {
          account: { select: { id: true, accountCode: true, name: true, type: true } },
        },
      },
    },
  });
}

async function createJournalEntry(data: {
  entryNumber: string;
  date: string;
  description?: string;
  reference?: string;
  createdBy?: string;
  lines: Array<{
    accountId: string;
    debit: number;
    credit: number;
    description?: string;
  }>;
}) {
  if (!data.lines || data.lines.length < 2) {
    throw new AccountingError("Journal entry must have at least 2 lines", 400);
  }

  const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new AccountingError(
      `Debits (${totalDebit}) must equal credits (${totalCredit})`,
      400
    );
  }

  const existing = await prisma.journalEntry.findUnique({
    where: { entryNumber: data.entryNumber },
  });
  if (existing) throw new AccountingError("Entry number already exists", 409);

  const entry = await prisma.journalEntry.create({
    data: {
      entryNumber: data.entryNumber.trim(),
      date: new Date(data.date),
      description: data.description?.trim(),
      reference: data.reference?.trim(),
      totalDebit: new Prisma.Decimal(totalDebit),
      totalCredit: new Prisma.Decimal(totalCredit),
      createdBy: data.createdBy,
      status: "draft",
      lines: {
        create: data.lines.map((line) => ({
          accountId: line.accountId,
          debit: new Prisma.Decimal(line.debit),
          credit: new Prisma.Decimal(line.credit),
          description: line.description?.trim(),
        })),
      },
    },
    include: {
      lines: {
        include: {
          account: { select: { id: true, accountCode: true, name: true } },
        },
      },
    },
  });

  logger.info(`Journal entry created: ${entry.entryNumber}`);
  return entry;
}

async function postJournalEntry(id: string, approvedBy: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: { lines: true },
  });

  if (!entry) throw new AccountingError("Journal entry not found", 404);
  if (entry.status === "posted") throw new AccountingError("Entry is already posted", 400);

  // Update account balances
  for (const line of entry.lines) {
    const account = await prisma.chartOfAccount.findUnique({
      where: { id: line.accountId },
    });
    if (!account) continue;

    let balanceChange: Prisma.Decimal;
    if (["asset", "expense"].includes(account.type)) {
      balanceChange = line.debit.minus(line.credit);
    } else {
      balanceChange = line.credit.minus(line.debit);
    }

    await prisma.chartOfAccount.update({
      where: { id: account.id },
      data: { balance: account.balance.add(balanceChange) },
    });
  }

  const updated = await prisma.journalEntry.update({
    where: { id },
    data: { status: "posted", approvedBy },
    include: {
      lines: {
        include: { account: { select: { id: true, accountCode: true, name: true } } },
      },
    },
  });

  logger.info(`Journal entry posted: ${entry.entryNumber}`);
  return updated;
}

async function voidJournalEntry(id: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: { lines: true },
  });

  if (!entry) throw new AccountingError("Journal entry not found", 404);

  if (entry.status === "posted") {
    // Reverse the balances
    for (const line of entry.lines) {
      const account = await prisma.chartOfAccount.findUnique({
        where: { id: line.accountId },
      });
      if (!account) continue;

      let balanceChange: Prisma.Decimal;
      if (["asset", "expense"].includes(account.type)) {
        balanceChange = line.credit.minus(line.debit);
      } else {
        balanceChange = line.debit.minus(line.credit);
      }

      await prisma.chartOfAccount.update({
        where: { id: account.id },
        data: { balance: account.balance.add(balanceChange) },
      });
    }
  }

  return prisma.journalEntry.update({
    where: { id },
    data: { status: "voided" },
  });
}

// ─── INVOICES ──────────────────────────────────────────────

async function getInvoices(filters: {
  page: number;
  limit: number;
  skip: number;
  type?: string;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}) {
  const where: Prisma.InvoiceWhereInput = {};
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { invoiceNumber: { contains: filters.search, mode: "insensitive" } },
      { clientName: { contains: filters.search, mode: "insensitive" } },
      { clientEmail: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters.startDate || filters.endDate) {
    where.issueDate = {};
    if (filters.startDate) where.issueDate.gte = new Date(filters.startDate);
    if (filters.endDate) where.issueDate.lte = new Date(filters.endDate);
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        lineItems: true,
        _count: { select: { payments: true } },
      },
      orderBy: { issueDate: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  return { invoices, total };
}

async function getInvoiceById(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      lineItems: true,
      payments: { orderBy: { paymentDate: "desc" } },
    },
  });
}

async function createInvoice(data: {
  invoiceNumber: string;
  type: string;
  clientName: string;
  clientEmail?: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  createdBy?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }>;
}) {
  const existing = await prisma.invoice.findUnique({
    where: { invoiceNumber: data.invoiceNumber },
  });
  if (existing) throw new AccountingError("Invoice number already exists", 409);

  if (!data.lineItems || data.lineItems.length === 0) {
    throw new AccountingError("Invoice must have at least one line item", 400);
  }

  const lineItems = data.lineItems.map((item) => {
    const amount = item.quantity * item.unitPrice;
    return {
      description: item.description.trim(),
      quantity: new Prisma.Decimal(item.quantity),
      unitPrice: new Prisma.Decimal(item.unitPrice),
      amount: new Prisma.Decimal(amount),
      taxRate: new Prisma.Decimal(item.taxRate || 0),
    };
  });

  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.amount), 0);
  const taxAmount = lineItems.reduce(
    (sum, item) => sum + Number(item.amount) * (Number(item.taxRate) / 100),
    0
  );
  const totalAmount = subtotal + taxAmount;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: data.invoiceNumber.trim(),
      type: data.type,
      clientName: data.clientName.trim(),
      clientEmail: data.clientEmail?.trim(),
      issueDate: new Date(data.issueDate),
      dueDate: new Date(data.dueDate),
      subtotal: new Prisma.Decimal(subtotal),
      taxAmount: new Prisma.Decimal(taxAmount),
      totalAmount: new Prisma.Decimal(totalAmount),
      notes: data.notes?.trim(),
      createdBy: data.createdBy,
      lineItems: { create: lineItems },
    },
    include: { lineItems: true },
  });

  logger.info(`Invoice created: ${invoice.invoiceNumber}`);
  return invoice;
}

async function updateInvoiceStatus(id: string, status: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new AccountingError("Invoice not found", 404);

  return prisma.invoice.update({
    where: { id },
    data: { status },
    include: { lineItems: true },
  });
}

async function getInvoiceSummary() {
  const [totalInvoices, statusBreakdown, overdue, recentPayments] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      _count: true,
      _sum: { totalAmount: true },
    }),
    prisma.invoice.count({
      where: {
        status: { in: ["sent", "overdue"] },
        dueDate: { lt: new Date() },
      },
    }),
    prisma.payment.findMany({
      take: 10,
      orderBy: { paymentDate: "desc" },
      include: { invoice: { select: { invoiceNumber: true, clientName: true } } },
    }),
  ]);

  return {
    totalAmount: Number(totalInvoices._sum.totalAmount || 0),
    totalPaid: Number(totalInvoices._sum.paidAmount || 0),
    outstanding: Number(totalInvoices._sum.totalAmount || 0) - Number(totalInvoices._sum.paidAmount || 0),
    count: totalInvoices._count,
    overdueCount: overdue,
    byStatus: statusBreakdown.map((s) => ({
      status: s.status,
      count: s._count,
      total: Number(s._sum.totalAmount || 0),
    })),
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      date: p.paymentDate,
      method: p.paymentMethod,
      invoice: p.invoice,
    })),
  };
}

// ─── PAYMENTS ──────────────────────────────────────────────

async function getPayments(filters: {
  page: number;
  limit: number;
  skip: number;
  invoiceId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  const where: Prisma.PaymentWhereInput = {};
  if (filters.invoiceId) where.invoiceId = filters.invoiceId;
  if (filters.status) where.status = filters.status;
  if (filters.startDate || filters.endDate) {
    where.paymentDate = {};
    if (filters.startDate) where.paymentDate.gte = new Date(filters.startDate);
    if (filters.endDate) where.paymentDate.lte = new Date(filters.endDate);
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        invoice: { select: { id: true, invoiceNumber: true, clientName: true, totalAmount: true } },
      },
      orderBy: { paymentDate: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return { payments, total };
}

async function recordPayment(data: {
  invoiceId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}) {
  const payment = await prisma.payment.create({
    data: {
      invoiceId: data.invoiceId,
      amount: new Prisma.Decimal(data.amount),
      paymentDate: new Date(data.paymentDate),
      paymentMethod: data.paymentMethod,
      reference: data.reference?.trim(),
      notes: data.notes?.trim(),
    },
    include: {
      invoice: { select: { id: true, invoiceNumber: true, clientName: true } },
    },
  });

  // Update invoice paid amount if linked
  if (data.invoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: data.invoiceId } });
    if (invoice) {
      const newPaid = invoice.paidAmount.add(new Prisma.Decimal(data.amount));
      const isPaid = newPaid.gte(invoice.totalAmount);

      await prisma.invoice.update({
        where: { id: data.invoiceId },
        data: {
          paidAmount: newPaid,
          status: isPaid ? "paid" : "partially_paid",
        },
      });
    }
  }

  logger.info(`Payment recorded: ${data.amount} via ${data.paymentMethod}`);
  return payment;
}

// ─── TAX RECORDS ───────────────────────────────────────────

async function getTaxRecords(filters: {
  page: number;
  limit: number;
  skip: number;
  taxType?: string;
  status?: string;
  period?: string;
}) {
  const where: Prisma.TaxRecordWhereInput = {};
  if (filters.taxType) where.taxType = filters.taxType;
  if (filters.status) where.status = filters.status;
  if (filters.period) where.period = filters.period;

  const [records, total] = await Promise.all([
    prisma.taxRecord.findMany({
      where,
      orderBy: { dueDate: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.taxRecord.count({ where }),
  ]);

  return { records, total };
}

async function createTaxRecord(data: {
  taxType: string;
  period: string;
  taxableAmount: number;
  taxAmount: number;
  dueDate: string;
  filingDate?: string;
  notes?: string;
}) {
  const record = await prisma.taxRecord.create({
    data: {
      taxType: data.taxType.trim(),
      period: data.period.trim(),
      taxableAmount: new Prisma.Decimal(data.taxableAmount),
      taxAmount: new Prisma.Decimal(data.taxAmount),
      dueDate: new Date(data.dueDate),
      filingDate: data.filingDate ? new Date(data.filingDate) : undefined,
      notes: data.notes?.trim(),
    },
  });

  logger.info(`Tax record created: ${data.taxType} - ${data.period}`);
  return record;
}

async function updateTaxRecord(
  id: string,
  data: { status?: string; filingDate?: string; notes?: string }
) {
  return prisma.taxRecord.update({
    where: { id },
    data: {
      ...(data.status && { status: data.status }),
      ...(data.filingDate && { filingDate: new Date(data.filingDate) }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() }),
    },
  });
}

// ─── TRIAL BALANCE ─────────────────────────────────────────

async function getTrialBalance() {
  const accounts = await prisma.chartOfAccount.findMany({
    where: { isActive: true },
    orderBy: { accountCode: "asc" },
  });

  let totalDebits = 0;
  let totalCredits = 0;

  const rows = accounts.map((acc) => {
    const balance = Number(acc.balance);
    const isDebitNormal = ["asset", "expense"].includes(acc.type);
    const debit = isDebitNormal && balance > 0 ? balance : (!isDebitNormal && balance < 0 ? Math.abs(balance) : 0);
    const credit = !isDebitNormal && balance > 0 ? balance : (isDebitNormal && balance < 0 ? Math.abs(balance) : 0);

    totalDebits += debit;
    totalCredits += credit;

    return {
      accountCode: acc.accountCode,
      name: acc.name,
      type: acc.type,
      debit,
      credit,
    };
  });

  return {
    rows,
    totalDebits: Math.round(totalDebits * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
  };
}

export class AccountingError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "AccountingError";
    this.statusCode = statusCode;
  }
}

const accountingService = {
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

export default accountingService;
