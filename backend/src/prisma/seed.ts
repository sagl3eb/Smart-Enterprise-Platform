// SEP — Combined Seed
// Single entry point for the entire database. Idempotent: re-running this
// script will not duplicate any data because every step uses upsert /
// "skip if rows exist" patterns.
//
// Run with: npm run prisma:seed
//
// Author: Saqqaf Al-Yazidi (TP075880)

import prisma from "./client";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import * as fs from "fs";
import * as path from "path";

const SALT_ROUNDS = 12;

const ALL_MODULES = [
  "dashboard", "hr", "finance", "accounting", "ict",
  "construction", "workforce", "predictive", "alerts",
];

// ─────────────────────────────────────────────────────────────
// SYSTEM-WIDE BOOTSTRAP DATA
// ─────────────────────────────────────────────────────────────

const ROLES_BOOTSTRAP = [
  { name: "super_admin", description: "Platform super administrator", permissions: { all: true, manage_orgs: true } },
  { name: "admin",       description: "Organization administrator",   permissions: { all: true } },
  { name: "manager",     description: "Department manager with elevated access", permissions: { read: true, write: true, approve: true } },
  { name: "employee",    description: "Regular employee with standard access",   permissions: { read: true, write_own: true } },
  { name: "viewer",      description: "Read-only access for stakeholders",       permissions: { read: true } },
];

const LEAVE_TYPES_BOOTSTRAP = [
  { name: "Annual Leave",    defaultDays: 21, isPaid: true,  requiresApproval: true,  description: "Standard annual vacation leave" },
  { name: "Sick Leave",      defaultDays: 14, isPaid: true,  requiresApproval: false, description: "Leave for medical reasons" },
  { name: "Personal Leave",  defaultDays: 5,  isPaid: true,  requiresApproval: true,  description: "Leave for personal matters" },
  { name: "Maternity Leave", defaultDays: 90, isPaid: true,  requiresApproval: true,  description: "Leave for maternity" },
  { name: "Paternity Leave", defaultDays: 14, isPaid: true,  requiresApproval: true,  description: "Leave for paternity" },
  { name: "Unpaid Leave",    defaultDays: 0,  isPaid: false, requiresApproval: true,  description: "Leave without pay" },
];

const CHATBOT_INTENTS = [
  { intentName: "hr_stats", patterns: ["how many employees", "employee count", "total employees", "hr stats", "hr statistics", "workforce size", "headcount", "staff count", "number of employees"], responseType: "api_query", responseData: { endpoint: "/api/v1/hr/stats", method: "GET", format: "hr_stats" }, module: "hr", priority: 10, isActive: true },
  { intentName: "hr_search_employee", patterns: ["find employee", "search employee", "look up employee", "employee details", "who is", "employee info", "employee profile"], responseType: "api_query", responseData: { endpoint: "/api/v1/hr/employees", method: "GET", format: "employee_list", params: { search: "$entity" } }, module: "hr", priority: 8, isActive: true },
  { intentName: "hr_departments", patterns: ["list departments", "show departments", "how many departments", "department list", "all departments", "which departments"], responseType: "api_query", responseData: { endpoint: "/api/v1/hr/departments", method: "GET", format: "department_list" }, module: "hr", priority: 7, isActive: true },
  { intentName: "hr_leave_requests", patterns: ["pending leaves", "leave requests", "who is on leave", "leave status", "pending leave requests", "show leaves", "leave applications"], responseType: "api_query", responseData: { endpoint: "/api/v1/hr/leave-requests", method: "GET", format: "leave_list", params: { status: "pending" } }, module: "hr", priority: 8, isActive: true },
  { intentName: "hr_create_employee", patterns: ["create employee", "add employee", "new employee", "hire employee", "register employee", "add new staff", "onboard employee"], responseType: "action", responseData: { action: "create_employee", endpoint: "/api/v1/hr/employees", method: "POST", requiresConfirmation: true }, module: "hr", priority: 9, isActive: true },
  { intentName: "hr_approve_leave", patterns: ["approve leave", "accept leave", "approve leave request", "grant leave"], responseType: "action", responseData: { action: "approve_leave", endpoint: "/api/v1/hr/leave-requests/:id/approve", method: "PUT", requiresConfirmation: true }, module: "hr", priority: 9, isActive: true },
  { intentName: "hr_reject_leave", patterns: ["reject leave", "deny leave", "decline leave request", "refuse leave"], responseType: "action", responseData: { action: "reject_leave", endpoint: "/api/v1/hr/leave-requests/:id/reject", method: "PUT", requiresConfirmation: true }, module: "hr", priority: 9, isActive: true },
  { intentName: "finance_budget_summary", patterns: ["budget summary", "budget overview", "how is the budget", "total budget", "budget status", "financial summary", "budget report", "spending overview"], responseType: "api_query", responseData: { endpoint: "/api/v1/finance/budgets/summary", method: "GET", format: "budget_summary" }, module: "finance", priority: 10, isActive: true },
  { intentName: "finance_transactions", patterns: ["recent transactions", "show transactions", "transaction list", "last transactions", "financial transactions", "money flow"], responseType: "api_query", responseData: { endpoint: "/api/v1/finance/transactions", method: "GET", format: "transaction_list" }, module: "finance", priority: 8, isActive: true },
  { intentName: "finance_create_transaction", patterns: ["create transaction", "add transaction", "new transaction", "record expense", "record income", "log transaction", "add expense"], responseType: "action", responseData: { action: "create_transaction", endpoint: "/api/v1/finance/transactions", method: "POST", requiresConfirmation: true }, module: "finance", priority: 9, isActive: true },
  { intentName: "finance_variance", patterns: ["variance analysis", "budget variance", "over budget", "under budget", "spending variance", "budget deviation"], responseType: "api_query", responseData: { endpoint: "/api/v1/finance/variance-analysis", method: "GET", format: "variance_analysis" }, module: "finance", priority: 7, isActive: true },
  { intentName: "accounting_invoices", patterns: ["show invoices", "invoice list", "pending invoices", "unpaid invoices", "overdue invoices", "invoice status", "accounts receivable"], responseType: "api_query", responseData: { endpoint: "/api/v1/accounting/invoices", method: "GET", format: "invoice_list" }, module: "accounting", priority: 8, isActive: true },
  { intentName: "accounting_trial_balance", patterns: ["trial balance", "account balances", "trial balance report", "financial statement"], responseType: "api_query", responseData: { endpoint: "/api/v1/accounting/trial-balance", method: "GET", format: "trial_balance" }, module: "accounting", priority: 7, isActive: true },
  { intentName: "ict_tickets", patterns: ["open tickets", "show tickets", "support tickets", "it tickets", "ticket list", "pending tickets", "unresolved tickets", "help desk"], responseType: "api_query", responseData: { endpoint: "/api/v1/ict/tickets", method: "GET", format: "ticket_list", params: { status: "open" } }, module: "ict", priority: 9, isActive: true },
  { intentName: "ict_create_ticket", patterns: ["create ticket", "new ticket", "submit ticket", "report issue", "log ticket", "raise ticket", "create support ticket", "i have an issue", "something is broken"], responseType: "action", responseData: { action: "create_ticket", endpoint: "/api/v1/ict/tickets", method: "POST", requiresConfirmation: true }, module: "ict", priority: 10, isActive: true },
  { intentName: "ict_assets", patterns: ["show assets", "it assets", "asset list", "equipment list", "asset inventory", "hardware list", "company assets"], responseType: "api_query", responseData: { endpoint: "/api/v1/ict/assets", method: "GET", format: "asset_list" }, module: "ict", priority: 7, isActive: true },
  { intentName: "project_status", patterns: ["project status", "show projects", "active projects", "project list", "project progress", "how are the projects", "construction projects", "project overview"], responseType: "api_query", responseData: { endpoint: "/api/v1/construction/projects", method: "GET", format: "project_list" }, module: "construction", priority: 9, isActive: true },
  { intentName: "project_update_progress", patterns: ["update project", "update progress", "change project status", "mark project complete", "project milestone"], responseType: "action", responseData: { action: "update_project", endpoint: "/api/v1/construction/projects/:id", method: "PUT", requiresConfirmation: true }, module: "construction", priority: 8, isActive: true },
  { intentName: "attrition_summary", patterns: ["attrition risk", "attrition summary", "who might leave", "flight risk", "employee turnover", "retention risk", "attrition rate", "churn risk"], responseType: "api_query", responseData: { endpoint: "/api/v1/workforce/attrition/summary", method: "GET", format: "attrition_summary" }, module: "workforce", priority: 10, isActive: true },
  { intentName: "alerts_unread", patterns: ["show alerts", "unread alerts", "any alerts", "notifications", "warnings", "what alerts", "pending alerts", "new alerts"], responseType: "api_query", responseData: { endpoint: "/api/v1/alerts", method: "GET", format: "alert_list", params: { isRead: "false" } }, module: "alerts", priority: 10, isActive: true },
  { intentName: "alerts_evaluate", patterns: ["run alerts", "check alerts", "evaluate alerts", "trigger alert check", "scan for issues"], responseType: "action", responseData: { action: "evaluate_alerts", endpoint: "/api/v1/alerts/evaluate", method: "POST" }, module: "alerts", priority: 8, isActive: true },
  { intentName: "ml_train_model", patterns: ["train model", "retrain model", "train attrition model", "train ml", "start training", "train machine learning"], responseType: "action", responseData: { action: "train_model", endpoint: "/api/v1/predictive/attrition/train", method: "POST" }, module: "predictive", priority: 8, isActive: true },
  { intentName: "ml_models_list", patterns: ["show models", "ml models", "model list", "what models", "model status", "prediction models", "machine learning models"], responseType: "api_query", responseData: { endpoint: "/api/v1/predictive/models", method: "GET", format: "model_list" }, module: "predictive", priority: 7, isActive: true },
  { intentName: "ml_forecast", patterns: ["generate forecast", "show forecast", "predict revenue", "forecast headcount", "predict future", "forecasting", "time series forecast"], responseType: "api_query", responseData: { endpoint: "/api/v1/predictive/forecast/sample/revenue", method: "GET", format: "forecast" }, module: "predictive", priority: 7, isActive: true },
  { intentName: "dashboard_summary", patterns: ["dashboard summary", "executive summary", "overview", "company overview", "business summary", "kpi summary", "show dashboard", "how is the company"], responseType: "api_query", responseData: { endpoint: "/api/v1/dashboard/summary", method: "GET", format: "dashboard_summary" }, module: "dashboard", priority: 10, isActive: true },
  { intentName: "dashboard_kpis", patterns: ["show kpis", "key metrics", "performance indicators", "kpi cards", "latest kpis", "key performance"], responseType: "api_query", responseData: { endpoint: "/api/v1/dashboard/kpis/latest", method: "GET", format: "kpi_cards" }, module: "dashboard", priority: 8, isActive: true },
  { intentName: "navigate_module", patterns: ["go to", "open", "navigate to", "take me to", "show me", "where is", "how do i find", "where can i find"], responseType: "static", responseData: { text: "I can help you navigate! Here are the available modules:\n\n📊 **Dashboard** — /dashboard\n👥 **HR Management** — /hr\n💰 **Finance** — /finance\n📋 **Accounting** — /accounting\n🖥️ **ICT Management** — /ict\n🏗️ **Projects** — /projects\n📈 **Workforce Analytics** — /workforce\n🤖 **Predictive Analytics** — /predictive\n⚠️ **Alerts** — /alerts\n⚙️ **Settings** — /settings" }, module: "navigation", priority: 5, isActive: true },
  { intentName: "help_capabilities", patterns: ["what can you do", "help", "capabilities", "what do you know", "how can you help", "what are your features", "commands", "what commands"], responseType: "static", responseData: { text: "I can help you with many things across the SEP platform — try asking about counts, budgets, tickets, projects, attrition, alerts, or just say \"take me to <module>\"." }, module: "help", priority: 15, isActive: true },
];

// ─────────────────────────────────────────────────────────────
// NOVA TENANT DATA
// ─────────────────────────────────────────────────────────────

const NOVA = {
  name: "Nova Digital",
  slug: "nova",
  adminEmail: "admin@nova.com",
  adminPassword: "admin123456",
  emailDomain: "nova.com",
};

const NOVA_DEPARTMENTS = [
  { name: "Engineering", code: "ENG", description: "Platform and product development" },
  { name: "Product",     code: "PRD", description: "Product strategy and design" },
  { name: "Sales",       code: "SLS", description: "Sales and account management" },
  { name: "Operations",  code: "OPS", description: "Operations and logistics" },
  { name: "Finance",     code: "FIN", description: "Finance and accounting" },
];

const NOVA_JOB_ROLES = [
  { name: "Software Engineer",          level: "IC" },
  { name: "Senior Software Engineer",   level: "IC" },
  { name: "Engineering Manager",        level: "Manager" },
  { name: "Product Manager",            level: "Manager" },
  { name: "UX Designer",                level: "IC" },
  { name: "Sales Representative",       level: "IC" },
  { name: "Sales Director",             level: "Director" },
  { name: "Operations Lead",            level: "Lead" },
  { name: "Financial Analyst",          level: "IC" },
  { name: "Controller",                 level: "Manager" },
];

type NovaEmp = { firstName: string; lastName: string; dept: string; position: string; salary: number; role: "manager" | "employee"; hireDaysAgo: number };

const NOVA_EMPLOYEES: NovaEmp[] = [
  { firstName: "Nadia",   lastName: "Koskinen", dept: "ENG", position: "Engineering Manager",      salary: 14500, role: "manager",  hireDaysAgo: 1460 },
  { firstName: "Ravi",    lastName: "Narayan",  dept: "ENG", position: "Senior Software Engineer", salary: 11200, role: "employee", hireDaysAgo: 980 },
  { firstName: "Elena",   lastName: "Morales",  dept: "ENG", position: "Software Engineer",        salary: 7800,  role: "employee", hireDaysAgo: 420 },
  { firstName: "Kenji",   lastName: "Tanaka",   dept: "ENG", position: "Software Engineer",        salary: 7500,  role: "employee", hireDaysAgo: 300 },
  { firstName: "Priya",   lastName: "Shah",     dept: "PRD", position: "Product Manager",          salary: 12500, role: "manager",  hireDaysAgo: 1120 },
  { firstName: "Mateusz", lastName: "Nowak",    dept: "PRD", position: "UX Designer",              salary: 8200,  role: "employee", hireDaysAgo: 560 },
  { firstName: "Amara",   lastName: "Okonkwo",  dept: "SLS", position: "Sales Director",           salary: 16500, role: "manager",  hireDaysAgo: 1680 },
  { firstName: "Tomas",   lastName: "Andersson", dept: "SLS", position: "Sales Representative",    salary: 6800,  role: "employee", hireDaysAgo: 510 },
  { firstName: "Leila",   lastName: "Hadid",    dept: "SLS", position: "Sales Representative",     salary: 6600,  role: "employee", hireDaysAgo: 240 },
  { firstName: "Jaxon",   lastName: "Mbeki",    dept: "OPS", position: "Operations Lead",          salary: 10200, role: "manager",  hireDaysAgo: 890 },
  { firstName: "Sienna",  lastName: "Ferreira", dept: "OPS", position: "Operations Analyst",       salary: 6400,  role: "employee", hireDaysAgo: 400 },
  { firstName: "Dmitri",  lastName: "Volkov",   dept: "FIN", position: "Controller",               salary: 13500, role: "manager",  hireDaysAgo: 1820 },
  { firstName: "Aisha",   lastName: "Rahimi",   dept: "FIN", position: "Financial Analyst",        salary: 7200,  role: "employee", hireDaysAgo: 620 },
  { firstName: "Felix",   lastName: "Bergmann", dept: "ENG", position: "Software Engineer",        salary: 7100,  role: "employee", hireDaysAgo: 180 },
  { firstName: "Yui",     lastName: "Kobayashi", dept: "PRD", position: "UX Designer",             salary: 7600,  role: "employee", hireDaysAgo: 150 },
];

const NOVA_CHART_OF_ACCOUNTS = [
  { accountCode: "1000", name: "Cash and Cash Equivalents", type: "asset" },
  { accountCode: "1200", name: "Accounts Receivable",       type: "asset" },
  { accountCode: "1500", name: "Computer Equipment",        type: "asset" },
  { accountCode: "2000", name: "Accounts Payable",          type: "liability" },
  { accountCode: "2500", name: "Deferred Revenue",          type: "liability" },
  { accountCode: "3000", name: "Common Stock",              type: "equity" },
  { accountCode: "4000", name: "SaaS Revenue",              type: "revenue" },
  { accountCode: "4100", name: "Professional Services",     type: "revenue" },
  { accountCode: "5000", name: "Salaries and Wages",        type: "expense" },
  { accountCode: "5200", name: "Cloud Infrastructure",      type: "expense" },
  { accountCode: "5300", name: "Marketing",                 type: "expense" },
];

const NOVA_BUDGET_CATEGORIES = [
  { name: "R&D",                   code: "RD",   type: "operational" },
  { name: "Sales & Marketing",     code: "SM",   type: "operational" },
  { name: "Operations",            code: "OP",   type: "operational" },
  { name: "G&A",                   code: "GA",   type: "operational" },
  { name: "Salaries",              code: "SAL",  type: "operational" },
  { name: "Marketing",             code: "MKT",  type: "operational" },
  { name: "Travel",                code: "TRV",  type: "operational" },
  { name: "Software Licenses",     code: "LIC",  type: "operational" },
  { name: "Cloud Infrastructure",  code: "CLD",  type: "capital" },
  { name: "Professional Services", code: "PRO",  type: "operational" },
  { name: "SaaS Revenue",          code: "SAAS", type: "revenue" },
];

const NOVA_BUDGET_ALLOCATIONS: Record<string, number> = {
  RD: 1200000, SM: 850000, OP: 400000, GA: 300000,
  SAL: 1500000, MKT: 600000, TRV: 200000, LIC: 350000,
  CLD: 800000, PRO: 250000, SAAS: 2000000,
};

const NOVA_COST_CENTERS = [
  { name: "Engineering", code: "CC-ENG", limit: 600000 },
  { name: "Sales",       code: "CC-SAL", limit: 450000 },
  { name: "Marketing",   code: "CC-MKT", limit: 300000 },
  { name: "Operations",  code: "CC-OPS", limit: 200000 },
  { name: "HR & Admin",  code: "CC-HR",  limit: 150000 },
];

const NOVA_ASSETS = [
  { assetTag: "NV-LAP-001", name: "MacBook Pro 16 M3",        category: "laptop",  manufacturer: "Apple",  model: "MBP16-M3",   purchasePrice: 3499  },
  { assetTag: "NV-LAP-002", name: "Dell XPS 15",              category: "laptop",  manufacturer: "Dell",   model: "XPS15-2024", purchasePrice: 2299  },
  { assetTag: "NV-LAP-003", name: "ThinkPad X1 Carbon",       category: "laptop",  manufacturer: "Lenovo", model: "X1C-G12",    purchasePrice: 2099  },
  { assetTag: "NV-MON-001", name: "Dell UltraSharp 27",       category: "monitor", manufacturer: "Dell",   model: "U2724DE",    purchasePrice: 649   },
  { assetTag: "NV-SRV-001", name: "AWS Reserved r6i.4xlarge", category: "server",  manufacturer: "AWS",    model: "r6i.4xlarge", purchasePrice: 18500 },
  { assetTag: "NV-DSK-001", name: "Mac Studio M2 Max",        category: "desktop", manufacturer: "Apple",  model: "MS-M2MAX",   purchasePrice: 3999  },
  { assetTag: "NV-PHN-001", name: "iPhone 15 Pro",            category: "phone",   manufacturer: "Apple",  model: "IP15P",      purchasePrice: 1099  },
  { assetTag: "NV-TAB-001", name: "iPad Pro 12.9",            category: "tablet",  manufacturer: "Apple",  model: "IPP12",      purchasePrice: 1299  },
];

const NOVA_TICKETS = [
  { ticketNumber: "NV-TKT-001", title: "VPN disconnects every 20 minutes", category: "Network",  priority: "high",     status: "in_progress" },
  { ticketNumber: "NV-TKT-002", title: "Slack not loading on Windows",     category: "Software", priority: "medium",   status: "open"        },
  { ticketNumber: "NV-TKT-003", title: "Provision new starter laptop",     category: "Hardware", priority: "medium",   status: "resolved"    },
  { ticketNumber: "NV-TKT-004", title: "MFA token device lost",            category: "Security", priority: "critical", status: "open"        },
  { ticketNumber: "NV-TKT-005", title: "GitHub repository access request", category: "Access",   priority: "low",      status: "resolved"    },
  { ticketNumber: "NV-TKT-006", title: "Printer jams on 3rd floor",        category: "Hardware", priority: "low",      status: "open"        },
];

const NOVA_PROJECTS = [
  { projectCode: "NV-PRJ-001", name: "AI Chatbot Platform",    status: "in_progress", budget: 450000, startDaysAgo: 180, durationDays: 365 },
  { projectCode: "NV-PRJ-002", name: "Data Lake Migration",    status: "planning",    budget: 280000, startDaysAgo: 30,  durationDays: 240 },
  { projectCode: "NV-PRJ-003", name: "Mobile App v3 Redesign", status: "in_progress", budget: 175000, startDaysAgo: 90,  durationDays: 180 },
];

// ─────────────────────────────────────────────────────────────
// NOVA SEED HELPERS
// ─────────────────────────────────────────────────────────────

async function ensureNovaOrg() {
  const org = await prisma.organization.upsert({
    where: { slug: NOVA.slug },
    update: {},
    create: { name: NOVA.name, slug: NOVA.slug, description: "Cloud-native SaaS tenant" },
  });
  for (const moduleName of ALL_MODULES) {
    await prisma.orgModule.upsert({
      where: { organizationId_moduleName: { organizationId: org.id, moduleName } },
      update: { isEnabled: true },
      create: { organizationId: org.id, moduleName, isEnabled: true },
    });
  }
  return org;
}

async function ensureNovaAdmin(orgId: string) {
  const adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
  if (!adminRole) throw new Error("admin role missing");

  let u = await prisma.user.findUnique({ where: { email: NOVA.adminEmail } });
  if (!u) {
    const hash = await bcrypt.hash(NOVA.adminPassword, SALT_ROUNDS);
    u = await prisma.user.create({
      data: {
        email: NOVA.adminEmail, passwordHash: hash,
        firstName: "Nova", lastName: "Admin",
        roleId: adminRole.id, organizationId: orgId, isActive: true,
      },
    });
  }
  for (const moduleName of ALL_MODULES) {
    await prisma.userModuleAccess.upsert({
      where: { userId_moduleName: { userId: u.id, moduleName } },
      update: { hasAccess: true },
      create: { userId: u.id, moduleName, hasAccess: true },
    });
  }
  return u;
}

async function seedNovaDepartments(orgId: string) {
  const map: Record<string, string> = {};
  for (const d of NOVA_DEPARTMENTS) {
    const row = await prisma.department.upsert({
      where: { organizationId_code: { organizationId: orgId, code: d.code } },
      update: { description: d.description },
      create: { organizationId: orgId, ...d },
    });
    map[d.code] = row.id;
  }
  return map;
}

async function seedNovaJobRoles(orgId: string) {
  for (const r of NOVA_JOB_ROLES) {
    await prisma.jobRole.upsert({
      where: { organizationId_name: { organizationId: orgId, name: r.name } },
      update: { level: r.level, isActive: true },
      create: { organizationId: orgId, name: r.name, level: r.level, isActive: true },
    });
  }
}

async function seedNovaEmployees(orgId: string, deptMap: Record<string, string>) {
  const empRole = await prisma.role.findUnique({ where: { name: "employee" } });
  const mgrRole = await prisma.role.findUnique({ where: { name: "manager" } });
  if (!empRole || !mgrRole) throw new Error("roles missing");

  const hash = await bcrypt.hash("employee123", SALT_ROUNDS);
  const basicModules = ["dashboard", "hr", "alerts"];
  const ids: string[] = [];

  let seq = 1;
  for (const emp of NOVA_EMPLOYEES) {
    const email = `${emp.firstName.toLowerCase()}.${emp.lastName.toLowerCase()}@${NOVA.emailDomain}`;
    const deptId = deptMap[emp.dept];
    if (!deptId) continue;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email, passwordHash: hash,
          firstName: emp.firstName, lastName: emp.lastName,
          roleId: emp.role === "manager" ? mgrRole.id : empRole.id,
          organizationId: orgId, isActive: true,
        },
      });
      for (const m of basicModules) {
        await prisma.userModuleAccess.upsert({
          where: { userId_moduleName: { userId: user.id, moduleName: m } },
          update: { hasAccess: true },
          create: { userId: user.id, moduleName: m, hasAccess: true },
        });
      }
    }

    const existing = await prisma.employee.findUnique({
      where: { organizationId_email: { organizationId: orgId, email } },
    });
    if (existing) { ids.push(existing.id); continue; }

    const hireDate = new Date();
    hireDate.setDate(hireDate.getDate() - emp.hireDaysAgo);
    const code = `EMP-${String(seq++).padStart(4, "0")}`;
    const row = await prisma.employee.create({
      data: {
        organizationId: orgId, userId: user.id,
        employeeCode: code, departmentId: deptId,
        firstName: emp.firstName, lastName: emp.lastName, email,
        position: emp.position, hireDate,
        salary: new Prisma.Decimal(emp.salary),
        employmentType: "full_time", status: "active",
      },
    });
    ids.push(row.id);
  }

  // Assign managers — first manager in each dept becomes the dept manager
  const deptManagers: Record<string, string> = {};
  for (let i = 0; i < NOVA_EMPLOYEES.length; i++) {
    const e = NOVA_EMPLOYEES[i];
    if (e.role === "manager" && !deptManagers[e.dept] && ids[i]) deptManagers[e.dept] = ids[i];
  }
  for (let i = 0; i < NOVA_EMPLOYEES.length; i++) {
    const e = NOVA_EMPLOYEES[i];
    const mgrId = deptManagers[e.dept];
    if (!mgrId || !ids[i] || ids[i] === mgrId) continue;
    await prisma.employee.update({ where: { id: ids[i] }, data: { managerId: mgrId } });
  }
  for (const [deptCode, empId] of Object.entries(deptManagers)) {
    if (deptMap[deptCode]) {
      await prisma.department.update({ where: { id: deptMap[deptCode] }, data: { managerId: empId } });
    }
  }
  return ids;
}

async function seedNovaChartOfAccounts(orgId: string) {
  const map: Record<string, string> = {};
  for (const a of NOVA_CHART_OF_ACCOUNTS) {
    const row = await prisma.chartOfAccount.upsert({
      where: { organizationId_accountCode: { organizationId: orgId, accountCode: a.accountCode } },
      update: { name: a.name, type: a.type },
      create: { organizationId: orgId, accountCode: a.accountCode, name: a.name, type: a.type, isActive: true },
    });
    map[a.accountCode] = row.id;
  }
  return map;
}

async function seedNovaFinance(orgId: string) {
  const currentYear = new Date().getFullYear();

  const catMap: Record<string, string> = {};
  for (const c of NOVA_BUDGET_CATEGORIES) {
    const row = await prisma.budgetCategory.upsert({
      where: { organizationId_code: { organizationId: orgId, code: c.code } },
      update: { name: c.name, type: c.type },
      create: { organizationId: orgId, ...c, isActive: true },
    });
    catMap[c.code] = row.id;
  }

  for (const [code, amount] of Object.entries(NOVA_BUDGET_ALLOCATIONS)) {
    const categoryId = catMap[code];
    if (!categoryId) continue;
    const spent = Math.round(amount * (0.25 + Math.random() * 0.4));
    await prisma.annualBudget.upsert({
      where: { categoryId_fiscalYear: { categoryId, fiscalYear: currentYear } },
      update: { allocatedAmount: new Prisma.Decimal(amount), organizationId: orgId },
      create: {
        organizationId: orgId, fiscalYear: currentYear, categoryId,
        allocatedAmount: new Prisma.Decimal(amount),
        spentAmount: new Prisma.Decimal(spent),
        remainingAmount: new Prisma.Decimal(amount - spent),
      },
    });
  }

  // No fake transactions are seeded — admins create real transactions via UI.

  for (const cc of NOVA_COST_CENTERS) {
    await prisma.costCenter.upsert({
      where: { organizationId_code: { organizationId: orgId, code: cc.code } },
      update: { name: cc.name, budgetLimit: new Prisma.Decimal(cc.limit) },
      create: { organizationId: orgId, name: cc.name, code: cc.code, budgetLimit: new Prisma.Decimal(cc.limit), isActive: true },
    });
  }
}

async function seedNovaAccounting(orgId: string, accountMap: Record<string, string>) {
  const existing = await prisma.journalEntry.count({ where: { organizationId: orgId } });
  if (existing === 0) {
    const entries = [
      { num: "JE-2024-001", desc: "Cloud services billed to enterprise customer", debit: "1200", credit: "4000", amount: 48000 },
      { num: "JE-2024-002", desc: "Payroll run — Engineering",                     debit: "5000", credit: "1000", amount: 92000 },
      { num: "JE-2024-003", desc: "AWS monthly infrastructure bill",                debit: "5200", credit: "2000", amount: 18500 },
      { num: "JE-2024-004", desc: "Marketing campaign — Q2 launch",                 debit: "5300", credit: "1000", amount: 22000 },
      { num: "JE-2024-005", desc: "Professional services engagement closed",        debit: "1000", credit: "4100", amount: 65000 },
    ];
    for (const e of entries) {
      const entry = await prisma.journalEntry.create({
        data: {
          organizationId: orgId,
          entryNumber: e.num,
          date: new Date(Date.now() - Math.floor(Math.random() * 180) * 86400000),
          description: e.desc,
          status: "posted",
          totalDebit: new Prisma.Decimal(e.amount),
          totalCredit: new Prisma.Decimal(e.amount),
        },
      });
      await prisma.journalLine.createMany({
        data: [
          { journalEntryId: entry.id, accountId: accountMap[e.debit],  debit: new Prisma.Decimal(e.amount), credit: new Prisma.Decimal(0),       description: e.desc },
          { journalEntryId: entry.id, accountId: accountMap[e.credit], debit: new Prisma.Decimal(0),       credit: new Prisma.Decimal(e.amount), description: e.desc },
        ],
      });
    }
  }

  const invoices = [
    { invoiceNumber: "NV-INV-1001", clientName: "Helios Partners",     total: 48000, status: "paid",    daysAgo: 60 },
    { invoiceNumber: "NV-INV-1002", clientName: "Atlas Manufacturing", total: 28500, status: "paid",    daysAgo: 45 },
    { invoiceNumber: "NV-INV-1003", clientName: "Meridian Health",     total: 72000, status: "sent",    daysAgo: 20 },
    { invoiceNumber: "NV-INV-1004", clientName: "Cascade Logistics",   total: 15400, status: "overdue", daysAgo: 75 },
    { invoiceNumber: "NV-INV-1005", clientName: "Polaris Retail",      total: 35000, status: "draft",   daysAgo: 5 },
  ];
  for (const inv of invoices) {
    const issueDate = new Date(); issueDate.setDate(issueDate.getDate() - inv.daysAgo);
    const dueDate = new Date(issueDate); dueDate.setDate(dueDate.getDate() + 30);
    await prisma.invoice.upsert({
      where: { organizationId_invoiceNumber: { organizationId: orgId, invoiceNumber: inv.invoiceNumber } },
      update: {},
      create: {
        organizationId: orgId,
        invoiceNumber: inv.invoiceNumber,
        type: "sent",
        clientName: inv.clientName,
        clientEmail: `billing@${inv.clientName.toLowerCase().replace(/\s+/g, "")}.com`,
        issueDate, dueDate,
        subtotal: new Prisma.Decimal(inv.total),
        taxAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(inv.total),
        paidAmount: new Prisma.Decimal(inv.status === "paid" ? inv.total : 0),
        status: inv.status,
      },
    });
  }
}

async function seedNovaIct(orgId: string) {
  for (const a of NOVA_ASSETS) {
    const purchaseDate = new Date(); purchaseDate.setDate(purchaseDate.getDate() - Math.floor(Math.random() * 900));
    await prisma.asset.upsert({
      where: { organizationId_assetTag: { organizationId: orgId, assetTag: a.assetTag } },
      update: {},
      create: {
        organizationId: orgId,
        assetTag: a.assetTag, name: a.name, category: a.category,
        manufacturer: a.manufacturer, model: a.model,
        purchaseDate, purchasePrice: new Prisma.Decimal(a.purchasePrice),
        status: "active",
      },
    });
  }
  for (const t of NOVA_TICKETS) {
    await prisma.itTicket.upsert({
      where: { organizationId_ticketNumber: { organizationId: orgId, ticketNumber: t.ticketNumber } },
      update: {},
      create: {
        organizationId: orgId,
        ticketNumber: t.ticketNumber, title: t.title,
        description: `Auto-seeded: ${t.title}`,
        category: t.category, priority: t.priority, status: t.status,
        reportedBy: "Nova employee",
      },
    });
  }
  await prisma.softwareLicense.upsert({
    where: { id: `${orgId}-slack` },
    update: {},
    create: {
      id: `${orgId}-slack`,
      organizationId: orgId,
      softwareName: "Slack Enterprise Grid",
      vendor: "Slack Technologies",
      licenseType: "per-seat",
      totalSeats: 50, usedSeats: 32,
      purchaseDate: new Date(Date.now() - 200 * 86400000),
      expiryDate: new Date(Date.now() + 165 * 86400000),
      annualCost: new Prisma.Decimal(18000),
      status: "active",
    },
  });
}

async function seedNovaProjects(orgId: string) {
  for (const p of NOVA_PROJECTS) {
    const startDate = new Date(); startDate.setDate(startDate.getDate() - p.startDaysAgo);
    const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + p.durationDays);
    await prisma.project.upsert({
      where: { organizationId_code: { organizationId: orgId, code: p.projectCode } },
      update: {},
      create: {
        organizationId: orgId,
        code: p.projectCode, name: p.name,
        description: `Strategic initiative: ${p.name}`,
        status: p.status,
        startDate, endDate,
        estimatedBudget: new Prisma.Decimal(p.budget),
        actualBudget: new Prisma.Decimal(Math.round(p.budget * Math.random() * 0.6)),
        progress: new Prisma.Decimal(p.status === "planning" ? 5 : 30 + Math.floor(Math.random() * 40)),
      },
    });
  }
}

async function seedNovaAlerts(orgId: string) {
  const existing = await prisma.alertRule.count({ where: { organizationId: orgId } });
  if (existing > 0) return;
  const rule = await prisma.alertRule.create({
    data: {
      organizationId: orgId,
      name: "Budget overspend threshold",
      module: "finance",
      metric: "budget_utilization",
      condition: ">",
      threshold: new Prisma.Decimal(0.9),
      severity: "high",
      isActive: true,
    },
  });
  await prisma.alert.create({
    data: {
      organizationId: orgId,
      ruleId: rule.id,
      title: "Marketing budget near limit",
      message: "Sales & Marketing category at 87% utilization with 2 months remaining",
      severity: "medium",
      module: "finance",
      isRead: false,
    },
  });
}

async function seedNovaTenant() {
  console.log(`\n═══ Tenant: ${NOVA.name} ═══`);
  const org = await ensureNovaOrg();
  console.log(`  ✓ Organization (${org.id})`);

  await ensureNovaAdmin(org.id);
  console.log(`  ✓ Admin ${NOVA.adminEmail}`);

  const deptMap = await seedNovaDepartments(org.id);
  console.log(`  ✓ ${NOVA_DEPARTMENTS.length} departments`);

  await seedNovaJobRoles(org.id);
  console.log(`  ✓ ${NOVA_JOB_ROLES.length} job roles`);

  const empIds = await seedNovaEmployees(org.id, deptMap);
  console.log(`  ✓ ${empIds.length} employees + linked user accounts`);

  const accountMap = await seedNovaChartOfAccounts(org.id);
  console.log(`  ✓ ${NOVA_CHART_OF_ACCOUNTS.length} chart of accounts`);

  await seedNovaFinance(org.id);
  console.log(`  ✓ Budgets + transactions + cost centers`);

  await seedNovaAccounting(org.id, accountMap);
  console.log(`  ✓ Journal entries + invoices`);

  await seedNovaIct(org.id);
  console.log(`  ✓ Assets + tickets + license`);

  await seedNovaProjects(org.id);
  console.log(`  ✓ ${NOVA_PROJECTS.length} projects`);

  await seedNovaAlerts(org.id);
  console.log(`  ✓ Alert rule + sample alert`);
}

// ─────────────────────────────────────────────────────────────
// APU TENANT (Asia Pacific University)
// ─────────────────────────────────────────────────────────────

const APU = {
  name: "APU - Asia Pacific University",
  slug: "apu",
  adminEmail: "admin@apu.com",
  adminPassword: "admin123456",
  emailDomain: "apu.com",
};

const APU_DEPARTMENTS = [
  { name: "School of Computing",       code: "SOC", description: "Computer science, software engineering, AI" },
  { name: "School of Engineering",     code: "ENG", description: "Mechanical, electrical, civil engineering" },
  { name: "School of Business",        code: "BUS", description: "Management, marketing, finance" },
  { name: "Library Services",          code: "LIB", description: "Information resources & research support" },
  { name: "Student Affairs",           code: "STD", description: "Student welfare, admissions, registrar" },
  { name: "ICT Department",            code: "ICT", description: "Campus IT infrastructure & helpdesk" },
];

const APU_JOB_ROLES = [
  { name: "Lecturer",                   level: "IC" },
  { name: "Senior Lecturer",            level: "Lead" },
  { name: "Associate Professor",        level: "Manager" },
  { name: "Professor",                  level: "Director" },
  { name: "Dean",                       level: "VP" },
  { name: "Administrative Officer",     level: "IC" },
  { name: "Librarian",                  level: "IC" },
  { name: "IT Support Engineer",        level: "IC" },
  { name: "Systems Administrator",      level: "IC" },
];

type ApuEmp = { firstName: string; lastName: string; dept: string; position: string; salary: number; role: "manager" | "employee"; hireDaysAgo: number };

const APU_EMPLOYEES: ApuEmp[] = [
  { firstName: "Hisham",   lastName: "Razak",     dept: "SOC", position: "Dean, School of Computing", salary: 18500, role: "manager",  hireDaysAgo: 2200 },
  { firstName: "Aisha",    lastName: "Othman",    dept: "SOC", position: "Senior Lecturer",          salary: 11200, role: "manager",  hireDaysAgo: 1640 },
  { firstName: "Vikram",   lastName: "Iyer",      dept: "SOC", position: "Lecturer",                 salary: 8200,  role: "employee", hireDaysAgo: 980  },
  { firstName: "Ling Mei", lastName: "Chong",     dept: "SOC", position: "Lecturer",                 salary: 7900,  role: "employee", hireDaysAgo: 720  },
  { firstName: "Ravi",     lastName: "Krishnan",  dept: "ENG", position: "Associate Professor",      salary: 13500, role: "manager",  hireDaysAgo: 1820 },
  { firstName: "Nurul",    lastName: "Hassan",    dept: "ENG", position: "Lecturer",                 salary: 8600,  role: "employee", hireDaysAgo: 540  },
  { firstName: "Daniel",   lastName: "Tan",       dept: "BUS", position: "Dean, School of Business", salary: 17800, role: "manager",  hireDaysAgo: 2100 },
  { firstName: "Siti",     lastName: "Aminah",    dept: "BUS", position: "Senior Lecturer",          salary: 10400, role: "employee", hireDaysAgo: 1320 },
  { firstName: "Mark",     lastName: "Wong",      dept: "LIB", position: "Head Librarian",           salary: 9200,  role: "manager",  hireDaysAgo: 1500 },
  { firstName: "Priya",    lastName: "Nair",      dept: "LIB", position: "Librarian",                salary: 6400,  role: "employee", hireDaysAgo: 320  },
  { firstName: "James",    lastName: "Lim",       dept: "STD", position: "Registrar",                salary: 11500, role: "manager",  hireDaysAgo: 1780 },
  { firstName: "Aminah",   lastName: "Yusof",     dept: "STD", position: "Administrative Officer",   salary: 5800,  role: "employee", hireDaysAgo: 410  },
  { firstName: "Karim",    lastName: "Abdullah",  dept: "ICT", position: "ICT Manager",              salary: 12800, role: "manager",  hireDaysAgo: 1900 },
  { firstName: "Wei",      lastName: "Zhang",     dept: "ICT", position: "Systems Administrator",    salary: 7600,  role: "employee", hireDaysAgo: 640  },
  { firstName: "Faiz",     lastName: "Rahman",    dept: "ICT", position: "IT Support Engineer",      salary: 5400,  role: "employee", hireDaysAgo: 230  },
];

const APU_BUDGET_CATEGORIES = [
  { name: "Faculty Salaries",      code: "FAC",  type: "operational" },
  { name: "Research Grants",       code: "RES",  type: "capital" },
  { name: "Library Resources",     code: "LIB",  type: "operational" },
  { name: "ICT Infrastructure",    code: "ICT",  type: "capital" },
  { name: "Student Services",      code: "STU",  type: "operational" },
  { name: "Tuition Revenue",       code: "TUI",  type: "revenue" },
];
const APU_BUDGET_ALLOCATIONS: Record<string, number> = {
  FAC: 4500000, RES: 1200000, LIB: 350000, ICT: 800000, STU: 600000, TUI: 6500000,
};

const APU_COA = [
  { accountCode: "1000", name: "Cash and Bank",          type: "asset" },
  { accountCode: "1200", name: "Tuition Receivable",     type: "asset" },
  { accountCode: "1500", name: "Campus Equipment",       type: "asset" },
  { accountCode: "2000", name: "Accounts Payable",       type: "liability" },
  { accountCode: "3000", name: "Endowment",              type: "equity" },
  { accountCode: "4000", name: "Tuition Revenue",        type: "revenue" },
  { accountCode: "4100", name: "Research Grants",        type: "revenue" },
  { accountCode: "5000", name: "Faculty Salaries",       type: "expense" },
  { accountCode: "5200", name: "Library Operations",     type: "expense" },
  { accountCode: "5300", name: "ICT Operations",         type: "expense" },
];

const APU_COST_CENTERS = [
  { name: "School of Computing",   code: "CC-APU-SOC", limit: 1500000 },
  { name: "School of Engineering", code: "CC-APU-ENG", limit: 1300000 },
  { name: "School of Business",    code: "CC-APU-BUS", limit: 1100000 },
  { name: "Library Services",      code: "CC-APU-LIB", limit: 350000 },
  { name: "ICT Department",        code: "CC-APU-ICT", limit: 800000 },
];

const APU_ASSETS = [
  { assetTag: "APU-LAP-001", name: "Faculty MacBook Pro 14",  category: "laptop",  manufacturer: "Apple",   model: "MBP14",      purchasePrice: 2599 },
  { assetTag: "APU-LAP-002", name: "Faculty ThinkPad T14",     category: "laptop",  manufacturer: "Lenovo",  model: "T14-G4",     purchasePrice: 1899 },
  { assetTag: "APU-LAB-001", name: "GPU Lab Workstation",      category: "desktop", manufacturer: "Dell",    model: "Precision",  purchasePrice: 4500 },
  { assetTag: "APU-NET-001", name: "Cisco Catalyst Switch",    category: "network", manufacturer: "Cisco",   model: "C9300",      purchasePrice: 6800 },
  { assetTag: "APU-MON-001", name: "Library Information Kiosk", category: "monitor", manufacturer: "Dell",    model: "P2722H",     purchasePrice: 320 },
  { assetTag: "APU-PHN-001", name: "Reception VoIP Phone",     category: "phone",   manufacturer: "Cisco",   model: "8851",       purchasePrice: 240 },
];

const APU_TICKETS = [
  { ticketNumber: "APU-TKT-001", title: "WiFi drops in Block C lecture halls", category: "Network",  priority: "high",     status: "in_progress" },
  { ticketNumber: "APU-TKT-002", title: "Library printer toner replacement",   category: "Hardware", priority: "low",      status: "open" },
  { ticketNumber: "APU-TKT-003", title: "Moodle login issue for new staff",     category: "Software", priority: "medium",   status: "resolved" },
  { ticketNumber: "APU-TKT-004", title: "Projector flickering in SOC-101",       category: "Hardware", priority: "medium",   status: "open" },
];

const APU_PROJECTS = [
  { projectCode: "APU-PRJ-001", name: "Smart Campus Sensor Rollout",  status: "in_progress", budget: 320000, startDaysAgo: 120, durationDays: 300 },
  { projectCode: "APU-PRJ-002", name: "Library Digital Archive",       status: "planning",    budget: 180000, startDaysAgo: 30,  durationDays: 240 },
];

async function seedApuTenant(roles: Record<string, string>) {
  console.log(`\n═══ Tenant: ${APU.name} ═══`);
  const employeeRole = roles["employee"];
  const managerRole  = roles["manager"];
  const adminRole    = roles["admin"];
  if (!employeeRole || !managerRole || !adminRole) throw new Error("APU seed: roles missing");

  // Org + modules
  const org = await prisma.organization.upsert({
    where: { slug: APU.slug },
    update: { name: APU.name, description: "Asia Pacific University of Technology & Innovation" },
    create: { name: APU.name, slug: APU.slug, description: "Asia Pacific University of Technology & Innovation" },
  });
  for (const m of ALL_MODULES) {
    await prisma.orgModule.upsert({
      where: { organizationId_moduleName: { organizationId: org.id, moduleName: m } },
      update: { isEnabled: true },
      create: { organizationId: org.id, moduleName: m, isEnabled: true },
    });
  }
  console.log(`  ✓ Organization (${org.id})`);

  // Admin
  let admin = await prisma.user.findUnique({ where: { email: APU.adminEmail } });
  if (!admin) {
    const hash = await bcrypt.hash(APU.adminPassword, SALT_ROUNDS);
    admin = await prisma.user.create({
      data: { email: APU.adminEmail, passwordHash: hash, firstName: "APU", lastName: "Admin", roleId: adminRole, organizationId: org.id, isActive: true },
    });
  }
  for (const m of ALL_MODULES) {
    await prisma.userModuleAccess.upsert({
      where: { userId_moduleName: { userId: admin.id, moduleName: m } },
      update: { hasAccess: true },
      create: { userId: admin.id, moduleName: m, hasAccess: true },
    });
  }
  console.log(`  ✓ Admin ${APU.adminEmail}`);

  // Departments
  const deptMap: Record<string, string> = {};
  for (const d of APU_DEPARTMENTS) {
    const row = await prisma.department.upsert({
      where: { organizationId_code: { organizationId: org.id, code: d.code } },
      update: { description: d.description },
      create: { organizationId: org.id, ...d },
    });
    deptMap[d.code] = row.id;
  }
  console.log(`  ✓ ${APU_DEPARTMENTS.length} departments`);

  // Job roles
  for (const r of APU_JOB_ROLES) {
    await prisma.jobRole.upsert({
      where: { organizationId_name: { organizationId: org.id, name: r.name } },
      update: { level: r.level, isActive: true },
      create: { organizationId: org.id, name: r.name, level: r.level, isActive: true },
    });
  }
  console.log(`  ✓ ${APU_JOB_ROLES.length} job roles`);

  // Employees — every one gets a User account first.
  const empHash = await bcrypt.hash("employee123", SALT_ROUNDS);
  const basicModules = ["dashboard", "hr", "alerts"];
  const empIds: string[] = [];
  let seq = 1;

  for (const emp of APU_EMPLOYEES) {
    const email = `${emp.firstName.toLowerCase().replace(/\s+/g, "")}.${emp.lastName.toLowerCase().replace(/\s+/g, "")}@${APU.emailDomain}`;
    const deptId = deptMap[emp.dept];
    if (!deptId) continue;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email, passwordHash: empHash,
          firstName: emp.firstName, lastName: emp.lastName,
          roleId: emp.role === "manager" ? managerRole : employeeRole,
          organizationId: org.id, isActive: true,
        },
      });
      for (const m of basicModules) {
        await prisma.userModuleAccess.upsert({
          where: { userId_moduleName: { userId: user.id, moduleName: m } },
          update: { hasAccess: true },
          create: { userId: user.id, moduleName: m, hasAccess: true },
        });
      }
    }

    const existing = await prisma.employee.findUnique({
      where: { organizationId_email: { organizationId: org.id, email } },
    });
    if (existing) { empIds.push(existing.id); continue; }

    const hireDate = new Date();
    hireDate.setDate(hireDate.getDate() - emp.hireDaysAgo);
    const code = `APU-EMP-${String(seq++).padStart(4, "0")}`;
    const row = await prisma.employee.create({
      data: {
        organizationId: org.id, userId: user.id,
        employeeCode: code, departmentId: deptId,
        firstName: emp.firstName, lastName: emp.lastName, email,
        position: emp.position, hireDate,
        salary: new Prisma.Decimal(emp.salary),
        employmentType: "full_time", status: "active",
      },
    });
    empIds.push(row.id);
  }
  console.log(`  ✓ ${empIds.length} employees + linked user accounts`);

  // Manager assignments
  const deptManagers: Record<string, string> = {};
  for (let i = 0; i < APU_EMPLOYEES.length; i++) {
    const e = APU_EMPLOYEES[i];
    if (e.role === "manager" && !deptManagers[e.dept] && empIds[i]) deptManagers[e.dept] = empIds[i];
  }
  for (let i = 0; i < APU_EMPLOYEES.length; i++) {
    const e = APU_EMPLOYEES[i];
    const mgrId = deptManagers[e.dept];
    if (!mgrId || !empIds[i] || empIds[i] === mgrId) continue;
    await prisma.employee.update({ where: { id: empIds[i] }, data: { managerId: mgrId } });
  }
  for (const [code, eId] of Object.entries(deptManagers)) {
    if (deptMap[code]) await prisma.department.update({ where: { id: deptMap[code] }, data: { managerId: eId } });
  }

  // Chart of accounts
  const accountMap: Record<string, string> = {};
  for (const a of APU_COA) {
    const row = await prisma.chartOfAccount.upsert({
      where: { organizationId_accountCode: { organizationId: org.id, accountCode: a.accountCode } },
      update: { name: a.name, type: a.type },
      create: { organizationId: org.id, accountCode: a.accountCode, name: a.name, type: a.type, isActive: true },
    });
    accountMap[a.accountCode] = row.id;
  }
  console.log(`  ✓ ${APU_COA.length} chart of accounts`);

  // Budget categories + annual budgets
  const year = new Date().getFullYear();
  const catMap: Record<string, string> = {};
  for (const c of APU_BUDGET_CATEGORIES) {
    const row = await prisma.budgetCategory.upsert({
      where: { organizationId_code: { organizationId: org.id, code: c.code } },
      update: { name: c.name, type: c.type },
      create: { organizationId: org.id, ...c, isActive: true },
    });
    catMap[c.code] = row.id;
  }
  for (const [code, amount] of Object.entries(APU_BUDGET_ALLOCATIONS)) {
    const categoryId = catMap[code];
    if (!categoryId) continue;
    const spent = Math.round(amount * (0.2 + Math.random() * 0.5));
    await prisma.annualBudget.upsert({
      where: { categoryId_fiscalYear: { categoryId, fiscalYear: year } },
      update: { allocatedAmount: new Prisma.Decimal(amount), organizationId: org.id },
      create: {
        organizationId: org.id, fiscalYear: year, categoryId,
        allocatedAmount: new Prisma.Decimal(amount),
        spentAmount: new Prisma.Decimal(spent),
        remainingAmount: new Prisma.Decimal(amount - spent),
      },
    });
  }
  // Cost centers (no fake transactions linked)
  for (const cc of APU_COST_CENTERS) {
    await prisma.costCenter.upsert({
      where: { organizationId_code: { organizationId: org.id, code: cc.code } },
      update: { name: cc.name, budgetLimit: new Prisma.Decimal(cc.limit) },
      create: { organizationId: org.id, name: cc.name, code: cc.code, budgetLimit: new Prisma.Decimal(cc.limit), isActive: true },
    });
  }
  console.log(`  ✓ Budgets + cost centers`);

  // Invoices (real records — tuition, no transaction linkage)
  const invoices = [
    { invoiceNumber: "APU-INV-2024-001", clientName: "Yayasan Pelajaran",      total: 240000, status: "paid",    daysAgo: 90 },
    { invoiceNumber: "APU-INV-2024-002", clientName: "MARA Education",         total: 180000, status: "paid",    daysAgo: 60 },
    { invoiceNumber: "APU-INV-2024-003", clientName: "Petronas Sponsorship",   total: 320000, status: "sent",    daysAgo: 25 },
    { invoiceNumber: "APU-INV-2024-004", clientName: "Sime Darby Foundation",  total: 65000,  status: "overdue", daysAgo: 80 },
  ];
  for (const inv of invoices) {
    const issueDate = new Date(); issueDate.setDate(issueDate.getDate() - inv.daysAgo);
    const dueDate = new Date(issueDate); dueDate.setDate(dueDate.getDate() + 30);
    await prisma.invoice.upsert({
      where: { organizationId_invoiceNumber: { organizationId: org.id, invoiceNumber: inv.invoiceNumber } },
      update: {},
      create: {
        organizationId: org.id, invoiceNumber: inv.invoiceNumber, type: "sent",
        clientName: inv.clientName, clientEmail: `billing@${inv.clientName.toLowerCase().replace(/\s+/g, "")}.com`,
        issueDate, dueDate,
        subtotal: new Prisma.Decimal(inv.total), taxAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(inv.total),
        paidAmount: new Prisma.Decimal(inv.status === "paid" ? inv.total : 0),
        status: inv.status,
      },
    });
  }
  console.log(`  ✓ ${invoices.length} invoices`);

  // Assets
  for (const a of APU_ASSETS) {
    const purchaseDate = new Date(); purchaseDate.setDate(purchaseDate.getDate() - Math.floor(Math.random() * 900));
    await prisma.asset.upsert({
      where: { organizationId_assetTag: { organizationId: org.id, assetTag: a.assetTag } },
      update: {},
      create: {
        organizationId: org.id, assetTag: a.assetTag, name: a.name, category: a.category,
        manufacturer: a.manufacturer, model: a.model,
        purchaseDate, purchasePrice: new Prisma.Decimal(a.purchasePrice),
        status: "active",
      },
    });
  }
  // Tickets
  for (const t of APU_TICKETS) {
    await prisma.itTicket.upsert({
      where: { organizationId_ticketNumber: { organizationId: org.id, ticketNumber: t.ticketNumber } },
      update: {},
      create: {
        organizationId: org.id, ticketNumber: t.ticketNumber, title: t.title,
        description: `Auto-seeded: ${t.title}`,
        category: t.category, priority: t.priority, status: t.status,
        reportedBy: "APU staff",
      },
    });
  }
  console.log(`  ✓ ${APU_ASSETS.length} assets, ${APU_TICKETS.length} tickets`);

  // Projects
  for (const p of APU_PROJECTS) {
    const startDate = new Date(); startDate.setDate(startDate.getDate() - p.startDaysAgo);
    const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + p.durationDays);
    await prisma.project.upsert({
      where: { organizationId_code: { organizationId: org.id, code: p.projectCode } },
      update: {},
      create: {
        organizationId: org.id, code: p.projectCode, name: p.name,
        description: `APU initiative: ${p.name}`, status: p.status,
        startDate, endDate,
        estimatedBudget: new Prisma.Decimal(p.budget),
        actualBudget: new Prisma.Decimal(Math.round(p.budget * Math.random() * 0.5)),
        progress: new Prisma.Decimal(p.status === "planning" ? 5 : 30 + Math.floor(Math.random() * 30)),
      },
    });
  }
  console.log(`  ✓ ${APU_PROJECTS.length} projects`);

  // Alert rule
  const ruleCount = await prisma.alertRule.count({ where: { organizationId: org.id } });
  if (ruleCount === 0) {
    const rule = await prisma.alertRule.create({
      data: {
        organizationId: org.id,
        name: "Tuition collection threshold",
        module: "finance", metric: "outstanding_invoices",
        condition: ">", threshold: new Prisma.Decimal(50000),
        severity: "high", isActive: true,
      },
    });
    await prisma.alert.create({
      data: {
        organizationId: org.id, ruleId: rule.id,
        title: "Outstanding tuition exceeds threshold",
        message: "Total outstanding tuition is RM 65,000 — collection action required.",
        severity: "medium", module: "finance", isRead: false,
      },
    });
    console.log(`  ✓ Alert rule + sample alert`);
  }
}

// ─────────────────────────────────────────────────────────────
// IBM TENANT (seeded from the IBM HR attrition dataset)
// ─────────────────────────────────────────────────────────────
//
// Every CSV row → one Employee + one User account. Predictive Analytics and
// Workforce Analytics in this org operate on real labelled data so the ML
// models can train against `attrition` ground truth.

const IBM = {
  name: "IBM HR Analytics",
  slug: "ibm",
  adminEmail: "admin@ibm.com",
  adminPassword: "admin123456",
  emailDomain: "ibm.com",
  csvPath: path.resolve(__dirname, "../../../ml-service/app/data/attrition_data.csv"),
  sampleSize: 150, // first N data rows of the CSV
};

const IBM_FIRST_NAMES = [
  "James","Mary","Robert","Patricia","Michael","Jennifer","William","Linda","David","Elizabeth",
  "Richard","Barbara","Joseph","Susan","Thomas","Jessica","Charles","Sarah","Christopher","Karen",
  "Daniel","Nancy","Matthew","Lisa","Anthony","Margaret","Mark","Betty","Donald","Sandra",
  "Steven","Ashley","Paul","Kimberly","Andrew","Donna","Joshua","Emily","Kenneth","Michelle",
  "Kevin","Carol","Brian","Amanda","George","Melissa","Edward","Deborah","Ronald","Stephanie",
];

const IBM_LAST_NAMES = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
  "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
  "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
  "Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
];

function ibmName(rowIndex: number): { first: string; last: string } {
  return {
    first: IBM_FIRST_NAMES[rowIndex % IBM_FIRST_NAMES.length],
    last: IBM_LAST_NAMES[Math.floor(rowIndex / IBM_FIRST_NAMES.length) % IBM_LAST_NAMES.length],
  };
}

function ibmPosition(department: string, jobLevel: number): string {
  const tier = ["Junior", "Associate", "Mid", "Senior", "Principal"][Math.max(0, Math.min(4, jobLevel - 1))] || "Mid";
  return `${tier} ${department} Specialist`;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
    else if (ch === '"') { inQuote = !inQuote; }
    else if (ch === "," && !inQuote) { out.push(cur); cur = ""; }
    else { cur += ch; }
  }
  out.push(cur);
  return out;
}

async function seedIbmTenant(roles: Record<string, string>) {
  console.log(`\n═══ Tenant: ${IBM.name} ═══`);
  const employeeRole = roles["employee"];
  const managerRole  = roles["manager"];
  const adminRole    = roles["admin"];
  if (!employeeRole || !managerRole || !adminRole) throw new Error("IBM seed: roles missing");

  if (!fs.existsSync(IBM.csvPath)) {
    console.log(`  ⚠ Dataset not found at ${IBM.csvPath} — skipping IBM seed`);
    return;
  }

  // Org + modules
  const org = await prisma.organization.upsert({
    where: { slug: IBM.slug },
    update: { name: IBM.name },
    create: { name: IBM.name, slug: IBM.slug, description: "IBM HR Analytics — ML training tenant" },
  });
  for (const m of ALL_MODULES) {
    await prisma.orgModule.upsert({
      where: { organizationId_moduleName: { organizationId: org.id, moduleName: m } },
      update: { isEnabled: true },
      create: { organizationId: org.id, moduleName: m, isEnabled: true },
    });
  }
  console.log(`  ✓ Organization (${org.id})`);

  // Admin
  let admin = await prisma.user.findUnique({ where: { email: IBM.adminEmail } });
  if (!admin) {
    const hash = await bcrypt.hash(IBM.adminPassword, SALT_ROUNDS);
    admin = await prisma.user.create({
      data: { email: IBM.adminEmail, passwordHash: hash, firstName: "IBM", lastName: "Admin", roleId: adminRole, organizationId: org.id, isActive: true },
    });
  }
  for (const m of ALL_MODULES) {
    await prisma.userModuleAccess.upsert({
      where: { userId_moduleName: { userId: admin.id, moduleName: m } },
      update: { hasAccess: true },
      create: { userId: admin.id, moduleName: m, hasAccess: true },
    });
  }
  console.log(`  ✓ Admin ${IBM.adminEmail}`);

  // Read + parse CSV
  const raw = fs.readFileSync(IBM.csvPath, "utf-8").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (raw.length < 2) {
    console.log(`  ⚠ CSV is empty — skipping`);
    return;
  }
  const header = parseCsvLine(raw[0]);
  const idx = (col: string) => header.indexOf(col);
  const colDept       = idx("department");
  const colJobLevel   = idx("job_level");
  const colMonthlyInc = idx("monthly_income");
  const colAge        = idx("age");
  const colYears      = idx("years_at_company");
  const colAttrition  = idx("attrition");
  const colSatisfaction = idx("job_satisfaction");
  const colPerformance = idx("performance_rating");
  const colOvertime   = idx("overtime");

  const sample = raw.slice(1, 1 + IBM.sampleSize);

  // Departments — derive from unique values in the sample
  const deptNames = Array.from(new Set(sample.map((line) => parseCsvLine(line)[colDept]).filter(Boolean)));
  const deptMap: Record<string, string> = {};
  for (let i = 0; i < deptNames.length; i++) {
    const name = deptNames[i];
    const code = name.toUpperCase().replace(/\s+/g, "").slice(0, 6);
    const row = await prisma.department.upsert({
      where: { organizationId_code: { organizationId: org.id, code } },
      update: { name, description: `${name} department` },
      create: { organizationId: org.id, name, code, description: `${name} department`, isActive: true },
    });
    deptMap[name] = row.id;
  }
  console.log(`  ✓ ${deptNames.length} departments`);

  // Job roles
  const jobRolesByLevel = ["Junior", "Associate", "Mid", "Senior", "Principal"];
  for (const lvl of jobRolesByLevel) {
    await prisma.jobRole.upsert({
      where: { organizationId_name: { organizationId: org.id, name: lvl } },
      update: { isActive: true },
      create: { organizationId: org.id, name: lvl, level: lvl === "Principal" ? "Director" : lvl === "Senior" ? "Lead" : lvl === "Mid" ? "Manager" : "IC", isActive: true },
    });
  }

  // Employees + Users + AttritionPredictions, in lockstep.
  const empHash = await bcrypt.hash("employee123", SALT_ROUNDS);
  const basicModules = ["dashboard", "hr", "alerts"];
  let createdEmp = 0, createdPred = 0;

  for (let i = 0; i < sample.length; i++) {
    const cells = parseCsvLine(sample[i]);
    const dept = cells[colDept];
    const deptId = deptMap[dept];
    if (!deptId) continue;

    const { first, last } = ibmName(i);
    // Disambiguate with row index so duplicates don't collide.
    const email = `${first.toLowerCase()}.${last.toLowerCase()}.${i + 1}@${IBM.emailDomain}`;
    const jobLevel = parseInt(cells[colJobLevel], 10) || 1;
    const monthlyIncome = parseFloat(cells[colMonthlyInc]) || 4000;
    const annualSalary = Math.round(monthlyIncome * 12);
    const age = parseInt(cells[colAge], 10) || 30;
    const years = parseInt(cells[colYears], 10) || 1;
    const attritionLabel = (cells[colAttrition] || "").trim() === "1" || /yes/i.test(cells[colAttrition] || "");
    const jobSat = parseFloat(cells[colSatisfaction]) || 3;
    const perfRating = parseFloat(cells[colPerformance]) || 3;
    const overtime = (cells[colOvertime] || "").trim().toLowerCase() === "yes";

    const isManagerLevel = jobLevel >= 4;
    const position = ibmPosition(dept, jobLevel);
    const hireDate = new Date();
    hireDate.setDate(hireDate.getDate() - years * 365);
    const dob = new Date(); dob.setFullYear(dob.getFullYear() - age);

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email, passwordHash: empHash,
          firstName: first, lastName: last,
          roleId: isManagerLevel ? managerRole : employeeRole,
          organizationId: org.id, isActive: true,
        },
      });
      for (const m of basicModules) {
        await prisma.userModuleAccess.upsert({
          where: { userId_moduleName: { userId: user.id, moduleName: m } },
          update: { hasAccess: true },
          create: { userId: user.id, moduleName: m, hasAccess: true },
        });
      }
    }

    const existing = await prisma.employee.findUnique({
      where: { organizationId_email: { organizationId: org.id, email } },
    });
    let employeeId = existing?.id;
    if (!employeeId) {
      const code = `IBM-${String(i + 1).padStart(5, "0")}`;
      const row = await prisma.employee.create({
        data: {
          organizationId: org.id, userId: user.id,
          employeeCode: code, departmentId: deptId,
          firstName: first, lastName: last, email,
          position, hireDate, dateOfBirth: dob,
          salary: new Prisma.Decimal(annualSalary),
          employmentType: "full_time",
          status: attritionLabel ? "terminated" : "active",
        },
      });
      employeeId = row.id;
      createdEmp++;
    }

    // Build a baseline attrition risk score from the labelled CSV row so the
    // Workforce / Predictive dashboards have data even before the ML service
    // trains on this data. Real training overwrites these.
    const overtimeBoost = overtime ? 0.12 : 0;
    const satScore = (5 - jobSat) / 5; // higher unhappy → higher risk
    const perfScore = (5 - perfRating) / 5;
    let raw = 0.25 + satScore * 0.25 + perfScore * 0.15 + overtimeBoost - (years * 0.01);
    if (attritionLabel) raw = Math.max(raw, 0.7); // ground-truth leavers stay high-risk
    const riskScore = Math.max(0.05, Math.min(0.95, raw));
    const riskLevel = riskScore >= 0.6 ? "high" : riskScore >= 0.35 ? "medium" : "low";

    const existingPred = await prisma.attritionPrediction.findFirst({ where: { employeeId } });
    if (!existingPred) {
      await prisma.attritionPrediction.create({
        data: {
          employeeId, departmentId: deptId,
          riskScore: new Prisma.Decimal(riskScore.toFixed(4)),
          riskLevel, modelVersion: "ibm-baseline-1.0",
          topFactors: { jobSatisfaction: jobSat, performanceRating: perfRating, overtime, yearsAtCompany: years, label: attritionLabel ? "left" : "stayed" } as Prisma.InputJsonValue,
          predictedAt: new Date(),
        },
      });
      createdPred++;
    }
  }
  console.log(`  ✓ ${createdEmp} employees + linked user accounts (${sample.length} CSV rows)`);
  console.log(`  ✓ ${createdPred} attrition predictions seeded from labels`);

  // Minimal other-module data so admin pages aren't empty.
  const year = new Date().getFullYear();
  const ibmCats = [
    { name: "Workforce Compensation", code: "IBM-COMP", type: "operational", amount: 8000000 },
    { name: "Research & Innovation",  code: "IBM-RND",  type: "capital",     amount: 2500000 },
    { name: "ICT & Operations",       code: "IBM-OPS",  type: "operational", amount: 1500000 },
    { name: "Subscription Revenue",   code: "IBM-REV",  type: "revenue",     amount: 12000000 },
  ];
  for (const c of ibmCats) {
    const cat = await prisma.budgetCategory.upsert({
      where: { organizationId_code: { organizationId: org.id, code: c.code } },
      update: { name: c.name, type: c.type },
      create: { organizationId: org.id, name: c.name, code: c.code, type: c.type, isActive: true },
    });
    const spent = Math.round(c.amount * (0.3 + Math.random() * 0.4));
    await prisma.annualBudget.upsert({
      where: { categoryId_fiscalYear: { categoryId: cat.id, fiscalYear: year } },
      update: { allocatedAmount: new Prisma.Decimal(c.amount), organizationId: org.id },
      create: {
        organizationId: org.id, fiscalYear: year, categoryId: cat.id,
        allocatedAmount: new Prisma.Decimal(c.amount),
        spentAmount: new Prisma.Decimal(spent),
        remainingAmount: new Prisma.Decimal(c.amount - spent),
      },
    });
  }
  for (const cc of [
    { name: "R&D",         code: "CC-IBM-RND", limit: 2000000 },
    { name: "Sales",       code: "CC-IBM-SAL", limit: 1500000 },
    { name: "Operations",  code: "CC-IBM-OPS", limit: 1200000 },
  ]) {
    await prisma.costCenter.upsert({
      where: { organizationId_code: { organizationId: org.id, code: cc.code } },
      update: { name: cc.name, budgetLimit: new Prisma.Decimal(cc.limit) },
      create: { organizationId: org.id, name: cc.name, code: cc.code, budgetLimit: new Prisma.Decimal(cc.limit), isActive: true },
    });
  }
  console.log(`  ✓ Budget categories + cost centers`);

  // A handful of IT assets and tickets so the ICT page populates
  const ibmAssets = [
    { assetTag: "IBM-LAP-001", name: "ThinkPad T14",  category: "laptop", manufacturer: "Lenovo", model: "T14",       price: 1599 },
    { assetTag: "IBM-LAP-002", name: "ThinkPad X1",   category: "laptop", manufacturer: "Lenovo", model: "X1-G12",    price: 1899 },
    { assetTag: "IBM-SRV-001", name: "Power Server",  category: "server", manufacturer: "IBM",    model: "Power10",   price: 18500 },
  ];
  for (const a of ibmAssets) {
    await prisma.asset.upsert({
      where: { organizationId_assetTag: { organizationId: org.id, assetTag: a.assetTag } },
      update: {},
      create: {
        organizationId: org.id, assetTag: a.assetTag, name: a.name, category: a.category,
        manufacturer: a.manufacturer, model: a.model,
        purchaseDate: new Date(Date.now() - Math.floor(Math.random() * 600) * 86400000),
        purchasePrice: new Prisma.Decimal(a.price), status: "active",
      },
    });
  }
  for (const t of [
    { ticketNumber: "IBM-TKT-001", title: "Watson API rate limit reached",  category: "Software", priority: "high",   status: "in_progress" },
    { ticketNumber: "IBM-TKT-002", title: "MFA enrollment for new starter", category: "Access",   priority: "medium", status: "open" },
  ]) {
    await prisma.itTicket.upsert({
      where: { organizationId_ticketNumber: { organizationId: org.id, ticketNumber: t.ticketNumber } },
      update: {},
      create: {
        organizationId: org.id, ticketNumber: t.ticketNumber, title: t.title,
        description: `Auto-seeded: ${t.title}`,
        category: t.category, priority: t.priority, status: t.status,
        reportedBy: "IBM staff",
      },
    });
  }
  console.log(`  ✓ ${ibmAssets.length} assets, 2 tickets`);
}

// ─────────────────────────────────────────────────────────────
// CLEANUP HELPERS (legacy data)
// ─────────────────────────────────────────────────────────────

async function purgeOrg(orgId: string, label: string) {
  const employees = await prisma.employee.findMany({ where: { organizationId: orgId }, select: { id: true } });
  const empIds = employees.map((e) => e.id);
  if (empIds.length) {
    await prisma.employee.updateMany({ where: { managerId: { in: empIds } }, data: { managerId: null } });
    await prisma.employee.deleteMany({ where: { id: { in: empIds } } });
  }
  const invoices = await prisma.invoice.findMany({ where: { organizationId: orgId }, select: { id: true } });
  if (invoices.length) {
    await prisma.payment.deleteMany({ where: { invoiceId: { in: invoices.map((i) => i.id) } } });
    await prisma.invoice.deleteMany({ where: { id: { in: invoices.map((i) => i.id) } } });
  }
  await prisma.journalEntry.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.transaction.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.taxRecord.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.financialReport.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.chartOfAccount.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.annualBudget.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.budgetCategory.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.costCenter.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.itTicket.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.asset.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.softwareLicense.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.networkDevice.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.project.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.material.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.equipmentFleet.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.workforceSurvey.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.forecast.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.anomalyDetection.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.optimizationSuggestion.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.kpiDefinition.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.alert.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.alertRule.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.workforceSnapshot.deleteMany({ where: { department: { organizationId: orgId } } }).catch(() => {});
  await prisma.trainingProgram.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.jobRole.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.department.deleteMany({ where: { organizationId: orgId } }).catch(() => {});

  const orgUsers = await prisma.user.findMany({ where: { organizationId: orgId }, select: { id: true } });
  const userIds = orgUsers.map((u) => u.id);
  if (userIds.length) {
    await prisma.userModuleAccess.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.chatbotSession.updateMany({ where: { userId: { in: userIds } }, data: { userId: null } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  await prisma.orgModule.deleteMany({ where: { organizationId: orgId } });
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  console.log(`  Removed org: ${label} (${userIds.length} users purged)`);
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("\nSeeding database (idempotent)...\n");

  // ── Roles ──
  const createdRoles: Record<string, string> = {};
  for (const role of ROLES_BOOTSTRAP) {
    const u = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, permissions: role.permissions },
      create: role,
    });
    createdRoles[role.name] = u.id;
  }
  console.log(`  ${ROLES_BOOTSTRAP.length} roles`);

  // ── SEP host organization ──
  // SEP hosts the platform super admin and nothing else. No departments,
  // employees, or operational module data live here. Tenant orgs (APU, Nova)
  // hold the actual data.
  const sepOrg = await prisma.organization.upsert({
    where: { slug: "sep" },
    update: { name: "SEP", description: "Smart Enterprise Platform — platform host" },
    create: { name: "SEP", slug: "sep", description: "Smart Enterprise Platform — platform host" },
  });
  for (const moduleName of ALL_MODULES) {
    await prisma.orgModule.upsert({
      where: { organizationId_moduleName: { organizationId: sepOrg.id, moduleName } },
      update: { isEnabled: true },
      create: { organizationId: sepOrg.id, moduleName, isEnabled: true },
    });
  }
  console.log(`  SEP host org`);

  // ── Super Admin (platform-level, lives under SEP) ──
  const superEmail = "super@sep.com";
  let superUser = await prisma.user.findUnique({ where: { email: superEmail } });
  if (!superUser) {
    const hash = await bcrypt.hash("super123456", SALT_ROUNDS);
    superUser = await prisma.user.create({
      data: { email: superEmail, passwordHash: hash, firstName: "Platform", lastName: "SuperAdmin", roleId: createdRoles["super_admin"], organizationId: sepOrg.id, isActive: true },
    });
    for (const moduleName of ALL_MODULES) {
      await prisma.userModuleAccess.upsert({
        where: { userId_moduleName: { userId: superUser.id, moduleName } },
        update: { hasAccess: true },
        create: { userId: superUser.id, moduleName, hasAccess: true },
      });
    }
    console.log(`  Super admin created: ${superEmail} / super123456`);
  } else {
    if (superUser.organizationId !== sepOrg.id) {
      await prisma.user.update({ where: { id: superUser.id }, data: { organizationId: sepOrg.id } });
    }
    console.log(`  Super admin exists: ${superEmail}`);
  }


  // ── Leave types ──
  for (const lt of LEAVE_TYPES_BOOTSTRAP) {
    await prisma.leaveType.upsert({ where: { name: lt.name }, update: {}, create: lt });
  }
  console.log(`  ${LEAVE_TYPES_BOOTSTRAP.length} leave types`);

  // ── Chatbot intents ──
  for (const intent of CHATBOT_INTENTS) {
    await prisma.chatbotIntent.upsert({
      where: { intentName: intent.intentName },
      update: { patterns: intent.patterns, responseType: intent.responseType, responseData: intent.responseData, priority: intent.priority, isActive: intent.isActive },
      create: { intentName: intent.intentName, patterns: intent.patterns, responseType: intent.responseType, responseData: intent.responseData, priority: intent.priority, isActive: intent.isActive },
    });
  }
  console.log(`  ${CHATBOT_INTENTS.length} chatbot intents`);

  // ── Cleanup legacy demo orgs/users (idempotent) ──
  const staleOrgs = await prisma.organization.findMany({
    where: {
      OR: [
        { slug: { in: ["acme", "globex"] } },
        { name: { contains: "acme", mode: "insensitive" } },
        { name: { contains: "globex", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true },
  });
  for (const s of staleOrgs) await purgeOrg(s.id, `${s.name} [${s.slug}]`);

  const stalePatterns = [
    { contains: "@acme.",   label: "acme" },
    { contains: "@globex.", label: "globex" },
    { endsWith: "@acme.com", label: "acme" },
    { endsWith: "@globex.com", label: "globex" },
  ];
  for (const p of stalePatterns) {
    const matched = await prisma.user.findMany({
      where: p.contains ? { email: { contains: p.contains, mode: "insensitive" } } : { email: { endsWith: p.endsWith, mode: "insensitive" } },
      select: { id: true, email: true },
    });
    if (!matched.length) continue;
    const ids = matched.map((u) => u.id);
    await prisma.userModuleAccess.deleteMany({ where: { userId: { in: ids } } });
    await prisma.chatbotSession.updateMany({ where: { userId: { in: ids } }, data: { userId: null } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    console.log(`  Removed ${matched.length} legacy ${p.label} user(s)`);
  }

  // Stray @sep.com users (only the real super admin should have that email)
  const straySep = await prisma.user.findMany({
    where: { email: { endsWith: "@sep.com", not: superEmail } },
    select: { id: true, email: true },
  });
  if (straySep.length) {
    const ids = straySep.map((u) => u.id);
    await prisma.userModuleAccess.deleteMany({ where: { userId: { in: ids } } });
    await prisma.chatbotSession.updateMany({ where: { userId: { in: ids } }, data: { userId: null } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    console.log(`  Removed ${straySep.length} stray @sep.com user(s)`);
  }

  // Orphan users (no organization) except super admin
  const orphans = await prisma.user.findMany({
    where: { organizationId: null, email: { not: superEmail } },
    select: { id: true, email: true },
  });
  if (orphans.length) {
    const ids = orphans.map((u) => u.id);
    await prisma.userModuleAccess.deleteMany({ where: { userId: { in: ids } } });
    await prisma.chatbotSession.updateMany({ where: { userId: { in: ids } }, data: { userId: null } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    console.log(`  Removed ${orphans.length} orphan user(s)`);
  }

  // Stale employees (linked to legacy demo email domains)
  const staleEmployees = await prisma.employee.findMany({
    where: {
      OR: [
        { email: { endsWith: "@sep.com", mode: "insensitive" } },
        { email: { contains: "@acme.", mode: "insensitive" } },
        { email: { contains: "@globex.", mode: "insensitive" } },
      ],
    },
    select: { id: true, userId: true },
  });
  if (staleEmployees.length) {
    const empIds = staleEmployees.map((e) => e.id);
    const linkedUserIds = staleEmployees.map((e) => e.userId).filter((v): v is string => !!v);

    await prisma.employee.updateMany({ where: { managerId: { in: empIds } }, data: { managerId: null } });
    await prisma.performanceReview.deleteMany({ where: { OR: [{ employeeId: { in: empIds } }, { reviewerId: { in: empIds } }] } }).catch(() => {});
    await prisma.employeeTraining.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {});
    await prisma.employeeDocument.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {});
    await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {});
    await prisma.employeeAttendance.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {});
    await prisma.attritionPrediction.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {});
    await prisma.employee.deleteMany({ where: { id: { in: empIds } } });

    if (linkedUserIds.length) {
      await prisma.userModuleAccess.deleteMany({ where: { userId: { in: linkedUserIds } } });
      await prisma.chatbotSession.updateMany({ where: { userId: { in: linkedUserIds } }, data: { userId: null } });
      await prisma.user.deleteMany({ where: { id: { in: linkedUserIds }, email: { not: superEmail } } });
    }
    console.log(`  Removed ${staleEmployees.length} stale employee(s)`);
  }

  // Drop fake CC-* legacy cost centers' transactions
  const fakeCcCodes = ["CC-FIN", "CC-OPS", "CC-HR", "CC-IT", "CC-LEGAL", "CC-MKT", "CC-RND", "CC-SALES"];
  const fakeCcs = await prisma.costCenter.findMany({ where: { code: { in: fakeCcCodes } }, select: { id: true } });
  if (fakeCcs.length) {
    const ccIds = fakeCcs.map((c) => c.id);
    const removed = await prisma.transaction.deleteMany({ where: { costCenterId: { in: ccIds } } });
    if (removed.count > 0) console.log(`  Removed ${removed.count} fake transactions from legacy cost centers`);
  }

  // Dedupe software licenses by (orgId, softwareName)
  const allLicenses = await prisma.softwareLicense.findMany({ orderBy: { createdAt: "asc" } });
  const seenKey = new Set<string>();
  const dupeIds: string[] = [];
  for (const lic of allLicenses) {
    const key = `${lic.organizationId ?? ""}|${lic.softwareName.trim().toLowerCase()}`;
    if (seenKey.has(key)) dupeIds.push(lic.id);
    else seenKey.add(key);
  }
  if (dupeIds.length > 0) {
    await prisma.softwareLicense.deleteMany({ where: { id: { in: dupeIds } } });
    console.log(`  Removed ${dupeIds.length} duplicate license row(s)`);
  }

  // ── Tenant: Nova Digital ──
  try {
    await seedNovaTenant();
  } catch (err) {
    console.error("  Nova seed failed:", err);
  }

  // ── Tenant: APU (Asia Pacific University) ──
  try {
    await seedApuTenant(createdRoles);
  } catch (err) {
    console.error("  APU seed failed:", err);
  }

  // ── Tenant: IBM (seeded from the IBM HR attrition dataset) ──
  // The IBM org's HR data IS the ML training dataset — every CSV row becomes
  // an Employee + User account, with attrition labels stored as features so
  // the predictive analytics module can train on real labelled data.
  try {
    await seedIbmTenant(createdRoles);
  } catch (err) {
    console.error("  IBM seed failed:", err);
  }

  console.log("\n✅ Seed completed.");
  console.log(`  Super admin: ${superEmail} / super123456`);
  console.log(`  APU admin:   ${APU.adminEmail} / ${APU.adminPassword}`);
  console.log(`  Nova admin:  ${NOVA.adminEmail} / ${NOVA.adminPassword}`);
  console.log(`  IBM admin:   ${IBM.adminEmail} / ${IBM.adminPassword}`);
  console.log(`  Re-running this seed is safe — every step is idempotent.\n`);
}

main()
  .catch((e) => { console.error("Seed error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
