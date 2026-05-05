import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";
import axios from "axios";

const BACKEND_URL = "http://localhost:3000/api/v1";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

type NavLink = { path: string; label: string };

interface PendingAction {
  action: string;
  endpoint: string;
  method: string;
  data: Record<string, any>;
  description: string;
  expiresAt: number;
}

const pendingActions: Map<string, PendingAction> = new Map();

// ─── Navigation Map ──────────────────────────────────────────
// Central table describing every page the assistant can direct users to.
// Descriptions feed the system prompt so the LLM knows what each route offers.

const NAV_MAP: Array<{ path: string; label: string; description: string; keywords: string[] }> = [
  { path: "/dashboard", label: "Dashboard", description: "Executive overview: KPIs, charts, unread alerts, recent activity.", keywords: ["dashboard", "home", "overview", "kpi"] },
  { path: "/directory", label: "Directory", description: "Searchable employee directory — find any colleague.", keywords: ["directory", "find employee", "employee directory", "org chart", "people"] },
  { path: "/me/leaves", label: "My Leaves", description: "Submit and track your own leave requests.", keywords: ["my leave", "vacation", "time off", "pto"] },
  { path: "/me/tickets", label: "My Tickets", description: "Submit IT tickets and track their resolution.", keywords: ["my tickets", "report issue", "help desk"] },
  { path: "/me/assets", label: "My Assets", description: "View IT assets (laptop, monitor, etc.) assigned to you.", keywords: ["my assets", "my laptop", "my equipment"] },

  { path: "/hr", label: "HR Management", description: "Manage employees, departments, leave approvals, job roles, performance reviews.", keywords: ["hr", "employee management", "headcount", "staff"] },
  { path: "/hr/departments", label: "Departments", description: "Manage departments and org structure.", keywords: ["departments"] },
  { path: "/hr/job-roles", label: "Job Roles", description: "Manage job role definitions and salary bands.", keywords: ["job roles", "positions"] },
  { path: "/hr/leave-approvals", label: "Leave Approvals", description: "Approve or reject pending leave requests.", keywords: ["leave approvals", "approve leave"] },

  { path: "/finance", label: "Finance", description: "Budget allocation, transactions, spending, variance, cash flow.", keywords: ["finance", "budget", "spending", "revenue"] },
  { path: "/finance/transactions", label: "Transactions", description: "Ledger of all financial transactions.", keywords: ["transactions", "journal", "ledger entries"] },
  { path: "/finance/statements", label: "Financial Statements", description: "Income statement, balance sheet, P&L.", keywords: ["statements", "p&l", "balance sheet"] },

  { path: "/accounting", label: "Accounting", description: "Invoices, chart of accounts, journal entries, trial balance.", keywords: ["accounting", "invoices", "chart of accounts"] },
  { path: "/accounting/invoices", label: "Invoices", description: "Create, send, and track invoices with line items and payments.", keywords: ["invoice", "billing", "accounts receivable"] },
  { path: "/accounting/chart-of-accounts", label: "Chart of Accounts", description: "Manage your COA structure.", keywords: ["chart of accounts", "coa"] },

  { path: "/ict", label: "ICT Management", description: "IT tickets, assets, licenses, SLA tracking.", keywords: ["ict", "it", "tech support"] },
  { path: "/ict/assets", label: "IT Assets", description: "Inventory of laptops, monitors, servers, and other hardware.", keywords: ["assets", "hardware", "inventory"] },
  { path: "/ict/tickets", label: "Tickets", description: "All IT tickets across the organization.", keywords: ["tickets", "support tickets"] },
  { path: "/ict/licenses", label: "Licenses", description: "Software licenses and subscriptions.", keywords: ["licenses", "software licenses", "subscriptions"] },

  { path: "/projects", label: "Projects", description: "Project management: milestones, tasks, materials, suppliers, equipment, team, budget.", keywords: ["projects", "construction", "site", "milestones", "materials", "suppliers"] },

  { path: "/workforce", label: "Workforce Analytics", description: "Attrition risk, satisfaction trends, engagement surveys.", keywords: ["workforce", "attrition", "turnover", "engagement"] },
  { path: "/workforce/attrition", label: "Attrition Dashboard", description: "ML-based attrition risk scores for every employee.", keywords: ["attrition risk", "turnover risk"] },
  { path: "/workforce/satisfaction", label: "Satisfaction Trends", description: "Employee satisfaction over time.", keywords: ["satisfaction", "engagement trend"] },
  { path: "/workforce/surveys", label: "Surveys", description: "Manage employee feedback surveys.", keywords: ["surveys", "feedback"] },

  { path: "/predictive", label: "Predictive Analytics", description: "ML models: attrition prediction, revenue forecasting, anomaly detection.", keywords: ["predictive", "forecast", "ml", "machine learning", "prediction"] },

  { path: "/alerts", label: "Alerts", description: "Automated alerts and notifications across all modules.", keywords: ["alerts", "notifications", "warnings"] },

  { path: "/chatbot", label: "Chatbot", description: "AI assistant (that's me!).", keywords: ["chatbot", "assistant"] },
  { path: "/settings", label: "Settings", description: "Profile, password, appearance, notification preferences.", keywords: ["settings", "profile", "password", "preferences"] },
  { path: "/settings?tab=users", label: "Admin Panel", description: "User management, organization management, module access (admins only).", keywords: ["admin panel", "user management", "manage users"] },
];

// ─── Enhanced Matching Utilities ──────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function extractEntities(message: string): Record<string, string> {
  const entities: Record<string, string> = {};

  const nameMatch = message.match(/(?:named?|called?|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  if (nameMatch) entities.name = nameMatch[1];

  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) entities.email = emailMatch[0];

  const idMatch = message.match(/(?:#|id\s*[:=]?\s*)(\w+)/i);
  if (idMatch) entities.id = idMatch[1];

  const deptMatch = message.match(/(?:department|dept)\s*[:=]?\s*(\w+)/i);
  if (deptMatch) entities.department = deptMatch[1];

  return entities;
}

// ─── Response Parsing: extract nav links from markdown ──────
// Ollama is instructed to emit [Label](/path) markdown links when suggesting pages.
// We strip them from the text and return them as structured nav chips.

function extractNavLinks(text: string): { cleaned: string; navigate: NavLink[] } {
  const linkRegex = /\[([^\]]+)\]\((\/[\w\-/?=&]*)\)/g;
  const navigate: NavLink[] = [];
  const seen = new Set<string>();
  let cleaned = text.replace(linkRegex, (_match, label: string, path: string) => {
    const key = `${path}|${label}`;
    if (!seen.has(key)) {
      seen.add(key);
      navigate.push({ path, label });
    }
    return `**${label}**`;
  });
  // Only return nav chips if we parsed at most 4 (keep UI tidy)
  return { cleaned, navigate: navigate.slice(0, 4) };
}

// ─── Preset library router ───────────────────────────────────
// Every question shown in the frontend question library is mapped here so it
// always lands on a known answer. Each entry is matched by either an exact
// canonical phrase or a tight regex; both are checked case-insensitively
// against the trimmed message.

type PresetAnswer = { intent: string; response: string; navigate?: NavLink[] };
type PresetEntry = {
  match: RegExp;
  resolve: (organizationId?: string) => Promise<PresetAnswer> | PresetAnswer;
};

function navResp(label: string, path: string, blurb?: string): PresetAnswer {
  return {
    intent: "navigation",
    response: blurb || `**${label}** is right here — opening the page.`,
    navigate: [{ path, label }],
  };
}

const PRESET_ENTRIES: PresetEntry[] = [
  // ── Navigation ─────────────────────────────────────────
  { match: /^take me to projects$|^go to projects$|^open projects$/i, resolve: () => navResp("Projects", "/projects", "Heading to **Projects** — milestones, tasks, materials, suppliers, equipment, and team rosters.") },
  { match: /^open the dashboard$|^go to dashboard$|^show.*dashboard$/i, resolve: () => navResp("Dashboard", "/dashboard", "Opening the **Dashboard** — KPIs, charts, alerts, recent activity.") },
  { match: /^go to hr management$|^open hr management$|^take me to hr$/i, resolve: () => navResp("HR Management", "/hr", "Opening **HR Management** — employees, departments, leave approvals, job roles.") },
  { match: /^show me alerts$|^open alerts$|^go to alerts$/i, resolve: () => navResp("Alerts", "/alerts", "Opening the **Alert Center** — automated notifications across modules.") },
  { match: /^open accounting invoices$|^show.*invoices$|^go to invoices$/i, resolve: () => navResp("Invoices", "/accounting/invoices", "Opening **Invoices** — create, send, track invoices and record payments.") },
  { match: /^take me to the employee directory$|^open the directory$|^show me the directory$/i, resolve: () => navResp("Directory", "/directory", "Opening the **Employee Directory** — searchable list of every colleague.") },
  { match: /^open settings$|^go to settings$/i, resolve: () => navResp("Settings", "/settings", "Opening **Settings** — profile, password, appearance, notifications.") },
  { match: /^open the admin panel$|^go to admin panel$|^show.*admin panel$/i, resolve: () => navResp("Admin Panel", "/settings?tab=users", "Opening the **Admin Panel** — user, organization, and module-access management.") },

  // ── HR & People ────────────────────────────────────────
  // "How many employees do we have?" → handled by directQuery (live count)
  // "Show pending leave requests" → handled by directQuery
  // "Show me attrition risk" → handled by directQuery
  { match: /^how does attrition prediction work\??$|^how does attrition work\??$|^how does prediction work\??$/i, resolve: () => ({
    intent: "kb_attrition_explained",
    response: "**Attrition Prediction** uses machine learning to estimate flight-risk per employee:\n• **Models**: LightGBM (boosted trees), Random Forest, Logistic Regression — best AUC wins\n• **Dataset**: IBM HR (~50k records) + your live employees\n• **Features**: tenure, salary band, overtime, satisfaction, performance, age, distance, education\n• **Output**: risk score 0–1, level (Low/Medium/High), and top contributing factors per person",
    navigate: [{ path: "/predictive", label: "Predictive Analytics" }, { path: "/workforce/attrition", label: "Attrition Dashboard" }],
  })},
  // "What departments exist?" → handled by directQuery
  { match: /^how do i request leave\??$|^how to request leave\??$/i, resolve: () => ({
    intent: "kb_request_leave",
    response: "Open **My Leaves**, click **New Leave Request**, choose a leave type and start/end dates. Your manager is notified for approval.",
    navigate: [{ path: "/me/leaves", label: "My Leaves" }],
  })},
  { match: /^show me the org chart$|^open org chart$|^show org chart$/i, resolve: () => ({
    intent: "kb_org_chart",
    response: "Use **Departments** for headcount per division and the **Directory** for individual contacts.",
    navigate: [{ path: "/hr/departments", label: "Departments" }, { path: "/directory", label: "Directory" }],
  })},

  // ── Finance & Accounting ───────────────────────────────
  // budget utilization, outstanding/overdue invoices, budget variance → directQuery
  { match: /^how do i create an invoice\??$|^how to create.*invoice\??$/i, resolve: () => ({
    intent: "kb_create_invoice",
    response: "**Accounting → Invoices → New Invoice**. Add the customer, line items (with tax), and due date. After creation, record payments via the Payments action.",
    navigate: [{ path: "/accounting/invoices", label: "Open Invoices" }],
  })},
  { match: /^what'?s the chart of accounts\??$|^show.*chart of accounts$|^open chart of accounts$/i, resolve: () => ({
    intent: "kb_chart_of_accounts",
    response: "The **Chart of Accounts** is the ledger structure — every debit and credit posts to one of these accounts. Manage it under Accounting → Chart of Accounts.",
    navigate: [{ path: "/accounting/chart-of-accounts", label: "Chart of Accounts" }],
  })},

  // ── IT & Assets ────────────────────────────────────────
  // open ticket counts / critical tickets / asset summary / licenses → directQuery
  // "Create an IT ticket for VPN issues" → tryAction
  { match: /^how do i report an issue\??$|^how to report an issue\??$/i, resolve: () => ({
    intent: "kb_report_issue",
    response: "Open **My Tickets** and click **New Ticket** — pick category and priority, describe the problem. Or just say \"create a ticket for X\" and I'll do it for you.",
    navigate: [{ path: "/me/tickets", label: "My Tickets" }],
  })},

  // ── Projects ───────────────────────────────────────────
  // active projects / project status → directQuery
  { match: /^how do i request materials\??$|^how to request materials\??$/i, resolve: () => ({
    intent: "kb_request_materials",
    response: "If you're on a project's team, the **My Projects** card on your dashboard has a **Request Material** button. Pick the material and quantity — the request goes to the project manager.",
    navigate: [{ path: "/dashboard", label: "Open Dashboard" }],
  })},
  { match: /^how do i create a project\??$|^how to create a project\??$/i, resolve: () => ({
    intent: "kb_create_project",
    response: "Open **Projects**, click **New Project**, fill in code/name/client/dates/budget. Once created, add milestones, tasks, materials, suppliers, and team members from the project detail page.",
    navigate: [{ path: "/projects", label: "Open Projects" }],
  })},
  { match: /^show me suppliers$|^show suppliers$|^list suppliers$/i, resolve: () => ({
    intent: "kb_suppliers",
    response: "Suppliers live inside each project — open **Projects → Suppliers** tab to view, rate, and manage every vendor across your portfolio.",
    navigate: [{ path: "/projects", label: "Open Projects" }],
  })},

  // ── Predictive & Analytics ─────────────────────────────
  { match: /^what is the workforce satisfaction trend\??$|^show.*satisfaction trend$/i, resolve: () => ({
    intent: "kb_satisfaction_trend",
    response: "**Satisfaction Trends** charts monthly engagement scores from surveys + structured pulse-checks. Open Workforce → Satisfaction Trends.",
    navigate: [{ path: "/workforce/satisfaction", label: "Satisfaction Trends" }],
  })},
  { match: /^show me forecasts\??$|^show forecasts\??$|^open forecasts$/i, resolve: () => ({
    intent: "kb_forecasts",
    response: "Forecasts use **Facebook Prophet** to project revenue, headcount, budget, and project completion. Open Predictive Analytics → Forecasts.",
    navigate: [{ path: "/predictive", label: "Predictive Analytics" }],
  })},
  { match: /^what ml models does sep use\??$|^what algorithms.*sep.*use\??$|^what ml.*sep.*use\??$/i, resolve: () => ({
    intent: "kb_ml_models",
    response: "SEP runs:\n• **LightGBM + Random Forest + Logistic Regression** — attrition risk (best AUC wins)\n• **Random Forest** — equipment failure prediction\n• **Isolation Forest** — anomaly detection\n• **Facebook Prophet** — revenue/headcount/budget forecasts\n• **Ollama llama3.2** — this chatbot",
    navigate: [{ path: "/predictive", label: "Predictive Analytics" }],
  })},
  { match: /^show predictive analytics$|^open predictive analytics$|^go to predictive$/i, resolve: () => navResp("Predictive Analytics", "/predictive", "Opening **Predictive Analytics** — attrition, equipment failure, anomaly detection, forecasts.") },

  // ── Platform & Help ────────────────────────────────────
  { match: /^what is sep\??$|^tell me about sep$|^what does sep do\??$/i, resolve: () => ({
    intent: "kb_about_sep",
    response: "**Smart Enterprise Platform (SEP)** is an integrated enterprise system with 9 modules:\n• Dashboard, HR Management, Finance, Accounting, ICT, Projects, Workforce Analytics, Predictive Analytics, Alerts\n\nPlus an AI chatbot (me!), role-based access, multi-org support, and an admin panel.",
    navigate: [{ path: "/dashboard", label: "Open Dashboard" }],
  })},
  { match: /^what can you do\??$|^help$|^capabilities\??$/i, resolve: () => ({
    intent: "kb_capabilities",
    response: "I can:\n• **Navigate** — \"take me to projects\", \"open finance\"\n• **Live data** — employees, budgets, tickets, projects, attrition, invoices, assets, licenses\n• **Actions** — create IT tickets (\"create a ticket for VPN\")\n• **FAQ** — how-tos for every module\n• **Explain** — platform, ML models, roles",
    navigate: [{ path: "/dashboard", label: "Start at Dashboard" }],
  })},
  { match: /^how do i change my password\??$|^how to change.*password\??$|^reset.*password$/i, resolve: () => ({
    intent: "kb_change_password",
    response: "Open **Settings → Profile**, enter your current password and a new one, then save.",
    navigate: [{ path: "/settings", label: "Open Settings" }],
  })},
  { match: /^toggle dark mode$|^dark mode$|^light mode$|^change theme$/i, resolve: () => ({
    intent: "kb_dark_mode",
    response: "Toggle dark/light mode using the **sun/moon icon** in the top-right of the header, or via Settings → Appearance.",
    navigate: [{ path: "/settings", label: "Open Settings" }],
  })},
  { match: /^who built sep\??$|^who made sep\??$|^who.*developer.*sep$/i, resolve: () => ({
    intent: "kb_developer",
    response: "SEP was built by **Saqqaf Al-Yazidi (TP075880)** as a Final Year Project — a full-stack enterprise platform with integrated ML capabilities.",
  })},
  { match: /^explain user roles$|^what are the user roles\??$|^what are the roles\??$/i, resolve: () => ({
    intent: "kb_roles",
    response: "SEP has 5 roles:\n• **Super Admin** — manages users + organizations only (no module data)\n• **Admin** — full org-wide module access plus admin panel\n• **Manager** — elevated access on modules\n• **Employee** — standard access\n• **Viewer** — read-only across the org",
    navigate: [{ path: "/settings?tab=users", label: "Admin Panel" }],
  })},
];

async function tryPresetAnswer(message: string, organizationId?: string): Promise<PresetAnswer | null> {
  const trimmed = message.trim();
  for (const entry of PRESET_ENTRIES) {
    if (entry.match.test(trimmed)) {
      return await entry.resolve(organizationId);
    }
  }
  return null;
}

// ─── Confirmation Flow ────────────────────────────────────────

function handleConfirmation(sessionId: string, message: string): string | null {
  const pending = pendingActions.get(sessionId);
  if (!pending) return null;

  if (Date.now() > pending.expiresAt) {
    pendingActions.delete(sessionId);
    return null;
  }

  const lower = message.toLowerCase().trim();
  const confirmWords = ["yes", "confirm", "ok", "sure", "go ahead", "do it", "proceed", "yep", "yeah", "y"];
  const cancelWords = ["no", "cancel", "stop", "nevermind", "nope", "abort", "n"];

  if (confirmWords.some((w) => lower === w || lower.startsWith(w))) {
    const action = pending;
    pendingActions.delete(sessionId);
    return `CONFIRMED:${JSON.stringify(action)}`;
  }

  if (cancelWords.some((w) => lower === w || lower.startsWith(w))) {
    pendingActions.delete(sessionId);
    return "Action cancelled. How else can I help you?";
  }

  return null;
}

function buildConfirmationMessage(
  sessionId: string,
  intentName: string,
  data: Record<string, unknown>,
  entities: Record<string, string>
): string {
  const action: PendingAction = {
    action: data.action as string,
    endpoint: data.endpoint as string,
    method: (data.method as string) || "POST",
    data: entities,
    description: intentName,
    expiresAt: Date.now() + 120000,
  };

  pendingActions.set(sessionId, action);

  const actionDescriptions: Record<string, string> = {
    create_employee: "create a new employee record",
    approve_leave: "approve a leave request",
    reject_leave: "reject a leave request",
    create_transaction: "create a new financial transaction",
    create_ticket: "create a new IT support ticket",
    update_project: "update a project",
    evaluate_alerts: "evaluate system alerts",
    train_model: "train the ML attrition model",
  };

  const desc = actionDescriptions[data.action as string] || `perform ${data.action}`;
  const entityInfo = Object.keys(entities).length > 0
    ? `\nDetails: ${Object.entries(entities).map(([k, v]) => `${k}: ${v}`).join(", ")}`
    : "";

  return `I'm about to **${desc}**.${entityInfo}\n\nPlease confirm by saying **yes** or **cancel** to abort. (Expires in 2 minutes)`;
}

// ─── Ollama LLM Integration (primary path) ───────────────────

async function gatherLiveContext(organizationId?: string): Promise<string> {
  try {
    const year = new Date().getFullYear();
    const orgFilter = organizationId ? { organizationId } : {};
    const leaveOrgFilter = organizationId ? { employee: { organizationId } } : {};
    const attritionOrgFilter = organizationId ? { employee: { organizationId } } : {};
    const [empCount, deptCount, pendingLeaves, budgetAgg, openTickets, activeProjects, highRisk, unreadAlerts, invoiceAgg] = await Promise.all([
      prisma.employee.count({ where: { status: "active", ...orgFilter } }),
      prisma.department.count({ where: { isActive: true, ...orgFilter } }),
      prisma.leaveRequest.count({ where: { status: "pending", ...leaveOrgFilter } }),
      prisma.annualBudget.aggregate({ where: { fiscalYear: year, ...orgFilter }, _sum: { allocatedAmount: true, spentAmount: true } }),
      prisma.itTicket.count({ where: { status: { in: ["open", "in_progress"] }, ...orgFilter } }),
      prisma.project.count({ where: { status: { in: ["active", "in_progress"] }, ...orgFilter } }),
      prisma.attritionPrediction.count({ where: { riskLevel: "high", ...attritionOrgFilter } }),
      prisma.alert.count({ where: { isRead: false, ...orgFilter } }),
      prisma.invoice.aggregate({ where: orgFilter, _sum: { totalAmount: true, paidAmount: true }, _count: true }),
    ]);
    const allocated = Number(budgetAgg._sum.allocatedAmount || 0);
    const spent = Number(budgetAgg._sum.spentAmount || 0);
    const util = allocated > 0 ? ((spent / allocated) * 100).toFixed(1) : "0";
    const outstanding = Number(invoiceAgg._sum.totalAmount || 0) - Number(invoiceAgg._sum.paidAmount || 0);

    return [
      `Live platform snapshot:`,
      `- Active employees: ${empCount} across ${deptCount} departments`,
      `- Pending leave requests: ${pendingLeaves}`,
      `- FY${year} budget: $${allocated.toLocaleString()} allocated, $${spent.toLocaleString()} spent (${util}% utilized)`,
      `- Open IT tickets: ${openTickets}`,
      `- Active projects: ${activeProjects}`,
      `- High-risk attrition: ${highRisk} employees`,
      `- Unread alerts: ${unreadAlerts}`,
      `- Invoices: ${invoiceAgg._count} total, $${outstanding.toLocaleString()} outstanding`,
    ].join("\n");
  } catch {
    return "";
  }
}

function buildSystemPrompt(liveContext: string): string {
  const navSection = NAV_MAP
    .map((n) => `${n.label} → ${n.path}`)
    .join("\n");

  return `You are SEP Assistant. Be brief: 1–3 short sentences, no headings, no long bullet lists.

Always end with a single markdown navigation link [Label](/path) when relevant. Pick from:
${navSection}

Live snapshot (caller's org only — never invent numbers):
${liveContext || "(unavailable)"}`;
}

async function tryOllamaChat(message: string, history: Array<{ role: string; content: string }>, organizationId?: string): Promise<{ success: boolean; response: string }> {
  try {
    const liveContext = await gatherLiveContext(organizationId);
    const systemPrompt = buildSystemPrompt(liveContext);

    const res = await axios.post(`${OLLAMA_URL}/api/chat`, {
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-4),
        { role: "user", content: message },
      ],
      stream: false,
      keep_alive: "30m",
      options: { temperature: 0.3, num_predict: 180, top_k: 30, top_p: 0.9 },
    }, { timeout: 30000 });

    const content = res.data?.message?.content;
    if (content) {
      return { success: true, response: content };
    }
    return { success: false, response: "" };
  } catch (err) {
    logger.debug(`Ollama unavailable, falling back to rule-based: ${err}`);
    return { success: false, response: "" };
  }
}

// ─── Rule-based fallback (when Ollama is offline) ────────────

function ruleNavigation(message: string): { response: string; navigate: NavLink[] } | null {
  const lower = message.toLowerCase().trim();
  const navVerb = /\b(go|take|open|navigate|show|bring|jump|where|find|access|visit|view|head)\b/.test(lower);

  const matches = NAV_MAP.filter((n) => {
    if (lower.includes(n.label.toLowerCase())) return true;
    return n.keywords.some((kw) => lower.includes(kw));
  });
  if (matches.length === 0) return null;

  const isShort = message.split(/\s+/).length <= 6;
  if (!navVerb && !isShort) return null;

  const primary = matches.sort((a, b) => b.path.length - a.path.length)[0];
  const others = matches.filter((m) => m.path !== primary.path).slice(0, 2);

  let response = `**${primary.label}** is the page for that. ${primary.description}`;
  if (others.length > 0) response += `\n\nRelated: ${others.map((o) => o.label).join(", ")}.`;

  return {
    response,
    navigate: [
      { path: primary.path, label: primary.label },
      ...others.map((o) => ({ path: o.path, label: o.label })),
    ],
  };
}

const enhancedKnowledgeBase: Array<{ keywords: string[]; response: string; navigate?: NavLink[] }> = [
  {
    keywords: ["what is sep", "what is smart enterprise", "about sep", "about this platform", "what does sep do", "tell me about sep"],
    response: "The **Smart Enterprise Platform (SEP)** is a comprehensive enterprise management system with 9 integrated modules:\n\n• **Dashboard** — Executive overview with KPIs\n• **HR Management** — Employee records, departments, leave management\n• **Finance** — Budgets, transactions, variance analysis\n• **Accounting** — Invoices, journal entries, trial balance\n• **ICT Management** — IT tickets, assets, SLA tracking\n• **Projects** — Project management with milestones, materials, suppliers\n• **Workforce Analytics** — Attrition risk, satisfaction trends\n• **Predictive Analytics** — ML-powered forecasting\n• **Alerts** — Automated threshold-based notifications\n\nPlus: AI chatbot (me!), role-based access, and admin controls.",
    navigate: [{ path: "/dashboard", label: "Open Dashboard" }],
  },
  {
    keywords: ["how does attrition work", "how does prediction work", "how does ml work", "machine learning explain"],
    response: "The **Attrition Prediction** system uses machine learning to estimate employee flight risk:\n\n• **Models**: Random Forest, Gradient Boosting, Logistic Regression\n• **Dataset**: IBM HR + internal — tens of thousands of records\n• **Features**: Age, salary, overtime, satisfaction, performance, tenure\n• **Output**: Risk score (0–1), level (Low/Medium/High), top factors",
    navigate: [{ path: "/predictive", label: "Predictive Analytics" }, { path: "/workforce/attrition", label: "Attrition Dashboard" }],
  },
  {
    keywords: ["help", "what can you do", "capabilities", "features"],
    response: "Here's what I can help with:\n\n🧭 **Navigation** — ask to go anywhere, I'll give you a link.\n📊 **Live data** — employee counts, budgets, tickets, projects, attrition, invoices, assets.\n🎫 **Actions** — create IT tickets (\"create a ticket for VPN issues\").\n💡 **FAQ** — how-to guides for every module.\n❓ **Explanations** — platform, ML models, roles, features.",
    navigate: [{ path: "/dashboard", label: "Start at Dashboard" }],
  },
  {
    keywords: ["who built", "who made", "developer", "author", "created by"],
    response: "SEP was built by **Saqqaf Al-Yazidi (TP075880)** as a Final Year Project — a full-stack enterprise platform with integrated ML capabilities.",
  },
  {
    keywords: ["thank", "thanks", "good job", "well done", "great"],
    response: "You're welcome! Let me know if there's anything else.",
  },
  {
    keywords: ["hello", "hi ", "hey", "good morning", "good afternoon", "good evening"],
    response: "Hello! I'm the SEP Assistant. I can navigate the platform, fetch live data, answer FAQs, and create IT tickets for you. What would you like to do?",
    navigate: [{ path: "/dashboard", label: "Go to Dashboard" }],
  },
  {
    keywords: ["change password", "update password", "reset password"],
    response: "Update your password in **Settings → Profile**. You'll enter your current password and a new one.",
    navigate: [{ path: "/settings", label: "Open Settings" }],
  },
  {
    keywords: ["dark mode", "light mode", "theme", "appearance"],
    response: "Toggle dark/light mode in **Settings → Appearance**, or click the sun/moon icon in the top bar.",
    navigate: [{ path: "/settings", label: "Open Settings" }],
  },
  {
    keywords: ["request leave", "apply for leave", "take vacation", "time off"],
    response: "Submit a leave request in **My Leaves**: pick a leave type, start and end dates, and optional reason. Your manager will be notified.",
    navigate: [{ path: "/me/leaves", label: "Request Leave" }],
  },
  {
    keywords: ["create invoice", "new invoice", "generate invoice"],
    response: "Create invoices in **Accounting → Invoices**. Add a customer, line items with taxes, a due date, and you can then record payments against it.",
    navigate: [{ path: "/accounting/invoices", label: "Open Invoices" }],
  },
  {
    keywords: ["create project", "new project", "start project"],
    response: "Go to **Projects**, click **New Project**, set code/name/client/dates/budget. You can then add milestones, tasks, materials, suppliers, and team members.",
    navigate: [{ path: "/projects", label: "Open Projects" }],
  },
  {
    keywords: ["request material", "order material", "project material"],
    response: "If you're on a project team, you'll see **My Projects** on your dashboard with a 'Request Material' button. Otherwise project managers can request materials directly from the Projects module.",
    navigate: [{ path: "/dashboard", label: "Go to Dashboard" }, { path: "/projects", label: "Open Projects" }],
  },
  {
    keywords: ["role", "permission", "rbac", "admin can", "user role"],
    response: "SEP has 5 roles:\n• **Super Admin** — platform-wide (manages users + organizations only)\n• **Admin** — org admin + Admin Panel\n• **Manager** — module manager\n• **Employee** — default\n• **Viewer** — read-only\n\nAdmins can switch between Admin View and Employee View with the top-bar toggle.",
    navigate: [{ path: "/settings?tab=users", label: "Admin Panel" }],
  },
  {
    keywords: ["how do i create a project", "new project", "start a project"],
    response: "Open **Projects**, click **New Project**, then fill in code/name/client/dates/budget. Once it's created you can add milestones, tasks, materials, suppliers, and team members from the project detail page.",
    navigate: [{ path: "/projects", label: "Open Projects" }],
  },
  {
    keywords: ["how do i request material", "request material", "order material", "project material"],
    response: "If you're on a project's team, the **My Projects** card on your dashboard has a **Request Material** button. Pick the material and quantity — your request goes to the project manager for approval.",
    navigate: [{ path: "/dashboard", label: "Open Dashboard" }],
  },
  {
    keywords: ["chart of accounts", "coa"],
    response: "The **Chart of Accounts** is your ledger structure: every debit/credit posts to one of these accounts. Open it from Accounting → Chart of Accounts.",
    navigate: [{ path: "/accounting/chart-of-accounts", label: "Open Chart of Accounts" }],
  },
  {
    keywords: ["how do i create an invoice", "create invoice", "new invoice", "generate invoice", "billing"],
    response: "Go to **Accounting → Invoices**, click **New Invoice**, add the customer, line items (with tax), and a due date. Record payments against it later via the Payments action.",
    navigate: [{ path: "/accounting/invoices", label: "Open Invoices" }],
  },
  {
    keywords: ["how do i report an issue", "report it issue", "report a bug", "submit an issue"],
    response: "Open **My Tickets** and click **New Ticket** — pick category, priority, and describe the issue. Or just say \"create a ticket for X\" here and I'll do it for you.",
    navigate: [{ path: "/me/tickets", label: "My Tickets" }],
  },
  {
    keywords: ["org chart", "organization chart", "reporting structure"],
    response: "Open **HR → Departments** to see headcount per department, or use the Directory to find any colleague.",
    navigate: [{ path: "/directory", label: "Open Directory" }, { path: "/hr/departments", label: "Departments" }],
  },
  {
    keywords: ["satisfaction trend", "engagement trend", "employee satisfaction"],
    response: "**Satisfaction Trends** shows monthly engagement scores. Survey responses + structured pulse-checks aggregate into the chart you'll see there.",
    navigate: [{ path: "/workforce/satisfaction", label: "Satisfaction Trends" }],
  },
  {
    keywords: ["forecast", "show me forecasts", "revenue forecast", "predict revenue"],
    response: "Open **Predictive Analytics** → Forecasts. Models use Facebook Prophet to project revenue, headcount, budget, and project completion over your chosen horizon.",
    navigate: [{ path: "/predictive", label: "Open Predictive Analytics" }],
  },
  {
    keywords: ["ml model", "machine learning model", "what ml", "what algorithms"],
    response: "SEP runs:\n• **Random Forest + LightGBM + Logistic Regression** — attrition risk prediction\n• **Random Forest** — equipment failure prediction\n• **Isolation Forest** — anomaly detection\n• **Facebook Prophet** — time-series forecasting\n• **Ollama (llama3.2)** — this chatbot",
    navigate: [{ path: "/predictive", label: "Open Predictive Analytics" }],
  },
  {
    keywords: ["budget variance", "show me variance", "over budget"],
    response: "**Variance Analysis** in Finance compares allocated vs. spent per category and flags over-budget lines. Open Finance to see the breakdown.",
    navigate: [{ path: "/finance", label: "Open Finance" }],
  },
];

function matchKnowledgeBase(message: string): { response: string; navigate?: NavLink[] } | null {
  const lower = message.toLowerCase();
  let bestMatch: { response: string; navigate?: NavLink[]; score: number } | null = null;

  for (const entry of enhancedKnowledgeBase) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (lower.includes(keyword)) {
        score += keyword.split(/\s+/).length;
      }
    }
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { response: entry.response, navigate: entry.navigate, score };
    }
  }

  return bestMatch ? { response: bestMatch.response, navigate: bestMatch.navigate } : null;
}

// ─── Direct DB Queries (live data) ───────────────────────────

async function directQuery(message: string, organizationId?: string): Promise<{ intent: string; response: string; navigate?: NavLink[] } | null> {
  const lower = message.toLowerCase();
  const orgFilter = organizationId ? { organizationId } : {};
  const leaveOrgFilter = organizationId ? { employee: { organizationId } } : {};
  const attritionOrgFilter = organizationId ? { employee: { organizationId } } : {};

  if (lower.match(/how many.*(employee|staff|people|worker)|employee.*count|headcount|total.*employee|hr.*stats/)) {
    try {
      const [total, active, deptCount, avgSalary, pendingLeaves] = await Promise.all([
        prisma.employee.count({ where: orgFilter }),
        prisma.employee.count({ where: { status: "active", ...orgFilter } }),
        prisma.department.count({ where: { isActive: true, ...orgFilter } }),
        prisma.employee.aggregate({ where: { status: "active", ...orgFilter }, _avg: { salary: true } }),
        prisma.leaveRequest.count({ where: { status: "pending", ...leaveOrgFilter } }),
      ]);
      return {
        intent: "hr_stats",
        response: `Here's the employee summary:\n• Total employees: ${total}\n• Active: ${active}\n• Departments: ${deptCount}\n• Average salary: $${Math.round(Number(avgSalary._avg.salary || 0)).toLocaleString()}\n• Pending leaves: ${pendingLeaves}`,
        navigate: [{ path: "/hr", label: "Open HR Management" }],
      };
    } catch (err) { logger.error(`Direct HR query failed: ${err}`); }
  }

  if (lower.match(/budget|spending|utilization|allocation|financial.*summary/)) {
    try {
      const year = new Date().getFullYear();
      const agg = await prisma.annualBudget.aggregate({
        where: { fiscalYear: year, ...orgFilter },
        _sum: { allocatedAmount: true, spentAmount: true },
        _count: true,
      });
      const allocated = Number(agg._sum.allocatedAmount || 0);
      const spent = Number(agg._sum.spentAmount || 0);
      const remaining = allocated - spent;
      const util = allocated > 0 ? ((spent / allocated) * 100).toFixed(1) : "0";
      return {
        intent: "budget_summary",
        response: `Budget Summary (FY ${year}):\n• Total Allocated: $${allocated.toLocaleString()}\n• Total Spent: $${spent.toLocaleString()}\n• Remaining: $${remaining.toLocaleString()}\n• Utilization: ${util}%\n• Budget lines: ${agg._count}`,
        navigate: [{ path: "/finance", label: "Open Finance" }],
      };
    } catch (err) { logger.error(`Direct budget query failed: ${err}`); }
  }

  if (lower.match(/open.*ticket|ticket.*open|how many.*ticket|ticket.*count|ticket.*status/)) {
    try {
      const [openCount, inProgress, total] = await Promise.all([
        prisma.itTicket.count({ where: { status: "open", ...orgFilter } }),
        prisma.itTicket.count({ where: { status: "in_progress", ...orgFilter } }),
        prisma.itTicket.count({ where: orgFilter }),
      ]);
      const recent = await prisma.itTicket.findMany({
        where: { status: { in: ["open", "in_progress"] }, ...orgFilter },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { ticketNumber: true, title: true, priority: true },
      });
      let response = `IT Tickets: ${total} total, ${openCount} open, ${inProgress} in progress.`;
      if (recent.length > 0) {
        response += "\n\nLatest open tickets:";
        recent.forEach((t) => { response += `\n• [${t.priority.toUpperCase()}] ${t.ticketNumber}: ${t.title}`; });
      }
      return { intent: "ticket_stats", response, navigate: [{ path: "/ict/tickets", label: "View All Tickets" }] };
    } catch (err) { logger.error(`Direct ticket query failed: ${err}`); }
  }

  if (lower.match(/active.*project|project.*active|project.*status|show.*project|list.*project|how many.*project/)) {
    try {
      const projects = await prisma.project.findMany({
        where: { status: { in: ["active", "in_progress"] }, ...orgFilter },
        take: 5,
        select: { code: true, name: true, progress: true, status: true },
        orderBy: { updatedAt: "desc" },
      });
      const totalActive = await prisma.project.count({ where: { status: { in: ["active", "in_progress"] }, ...orgFilter } });
      let response = `Active projects: ${totalActive}`;
      if (projects.length > 0) {
        response += "\n";
        projects.forEach((p) => { response += `\n• ${p.code}: ${p.name} — ${p.progress}% complete`; });
      }
      return { intent: "project_stats", response, navigate: [{ path: "/projects", label: "Open Projects" }] };
    } catch (err) { logger.error(`Direct project query failed: ${err}`); }
  }

  if (lower.match(/alert|notification|warning.*center|unread/)) {
    try {
      const alerts = await prisma.alert.findMany({
        where: { isRead: false, ...orgFilter },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { title: true, severity: true, module: true },
      });
      if (alerts.length === 0) {
        return { intent: "alerts", response: "No unread alerts at the moment. Everything looks good!", navigate: [{ path: "/alerts", label: "Open Alert Center" }] };
      }
      let response = `${alerts.length} unread alert(s):`;
      alerts.forEach((a) => { response += `\n• [${a.severity.toUpperCase()}] ${a.title} (${a.module})`; });
      return { intent: "alerts", response, navigate: [{ path: "/alerts", label: "Open Alert Center" }] };
    } catch (err) { logger.error(`Direct alerts query failed: ${err}`); }
  }

  if (lower.match(/attrition|turnover|retention|leave.*rate/)) {
    try {
      const predictions = await prisma.attritionPrediction.findMany({ where: attritionOrgFilter });
      const totalEmployees = await prisma.employee.count({ where: { status: "active", ...orgFilter } });
      const high = predictions.filter((p) => p.riskLevel === "high").length;
      const medium = predictions.filter((p) => p.riskLevel === "medium").length;
      const low = predictions.filter((p) => p.riskLevel === "low").length;
      const avg = predictions.length > 0 ? predictions.reduce((s, p) => s + Number(p.riskScore), 0) / predictions.length : 0;
      return {
        intent: "attrition_summary",
        response: `Attrition Risk Summary:\n• Total analyzed: ${predictions.length} employees (${totalEmployees} active)\n• High risk: ${high}\n• Medium risk: ${medium}\n• Low risk: ${low}\n• Average risk score: ${(avg * 100).toFixed(1)}%`,
        navigate: [{ path: "/workforce/attrition", label: "Full Breakdown" }],
      };
    } catch (err) { logger.error(`Direct attrition query failed: ${err}`); }
  }

  if (lower.match(/invoice|outstanding|overdue|payment.*due|accounts.*receivable/)) {
    try {
      const invoices = await prisma.invoice.findMany({ where: orgFilter, take: 100, select: { totalAmount: true, paidAmount: true, status: true } });
      const total = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
      const paid = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
      const overdue = invoices.filter((i) => i.status === "overdue").length;
      return {
        intent: "invoice_summary",
        response: `Invoice Summary:\n• Total invoiced: $${total.toLocaleString()}\n• Total paid: $${paid.toLocaleString()}\n• Outstanding: $${(total - paid).toLocaleString()}\n• Overdue: ${overdue} invoice(s)`,
        navigate: [{ path: "/accounting/invoices", label: "Open Invoices" }],
      };
    } catch (err) { logger.error(`Direct invoice query failed: ${err}`); }
  }

  if (lower.match(/(\bit\s*asset|hardware|laptop.*inventory|computer.*inventory|inventory.*it|it.*inventory|asset.*summary)/)) {
    try {
      const assets = await prisma.asset.findMany({ where: orgFilter, select: { status: true, purchasePrice: true } });
      const totalVal = assets.reduce((s: number, a: { purchasePrice: any }) => s + Number(a.purchasePrice || 0), 0);
      const active = assets.filter((a: { status: string }) => a.status === "active").length;
      return {
        intent: "asset_summary",
        response: `IT Asset Summary:\n• Total assets: ${assets.length}\n• Active: ${active}\n• Total value: $${totalVal.toLocaleString()}`,
        navigate: [{ path: "/ict/assets", label: "Open IT Assets" }],
      };
    } catch (err) { logger.error(`Direct asset query failed: ${err}`); }
  }

  // Pending leave requests
  if (lower.match(/pending.*leave|leave.*pending|leave.*request|leaves.*to.*approve/)) {
    try {
      const pending = await prisma.leaveRequest.findMany({
        where: { status: "pending", ...leaveOrgFilter },
        take: 8, orderBy: { createdAt: "desc" },
        select: { totalDays: true, employee: { select: { firstName: true, lastName: true } }, leaveType: { select: { name: true } } },
      });
      const total = await prisma.leaveRequest.count({ where: { status: "pending", ...leaveOrgFilter } });
      let response = `Pending leave requests: ${total}`;
      if (pending.length > 0) {
        response += "\n";
        pending.forEach((lr) => { response += `\n• ${lr.employee.firstName} ${lr.employee.lastName} — ${lr.leaveType?.name || "Leave"} (${lr.totalDays}d)`; });
      }
      return { intent: "leave_pending", response, navigate: [{ path: "/hr/leave-approvals", label: "Open Leave Approvals" }] };
    } catch (err) { logger.error(`Direct leave query failed: ${err}`); }
  }

  // Departments list
  if (lower.match(/(what|which|list|show).*department|department.*exist|departments?$/)) {
    try {
      const depts = await prisma.department.findMany({
        where: { isActive: true, ...orgFilter },
        select: { name: true, code: true, _count: { select: { employees: true } } },
        orderBy: { name: "asc" },
      });
      let response = `Active departments: ${depts.length}`;
      if (depts.length > 0) {
        response += "\n";
        depts.forEach((d) => { response += `\n• ${d.name} (${d.code}) — ${d._count.employees} employees`; });
      }
      return { intent: "departments", response, navigate: [{ path: "/hr/departments", label: "Open Departments" }] };
    } catch (err) { logger.error(`Direct departments query failed: ${err}`); }
  }

  // Critical tickets
  if (lower.match(/critical.*ticket|priority.*ticket|urgent.*ticket/)) {
    try {
      const critical = await prisma.itTicket.findMany({
        where: { priority: "critical", status: { not: "closed" }, ...orgFilter },
        take: 8, orderBy: { createdAt: "desc" },
        select: { ticketNumber: true, title: true, status: true },
      });
      let response = `Critical / unresolved tickets: ${critical.length}`;
      if (critical.length > 0) {
        response += "\n";
        critical.forEach((t) => { response += `\n• [${t.status.toUpperCase()}] ${t.ticketNumber}: ${t.title}`; });
      }
      return { intent: "critical_tickets", response, navigate: [{ path: "/ict/tickets", label: "Open Tickets" }] };
    } catch (err) { logger.error(`Direct critical-ticket query failed: ${err}`); }
  }

  // Software licenses
  if (lower.match(/(software\s*licen[sc]e|licen[sc]e.*list|how many.*licen[sc]e|show.*licen[sc]e)/)) {
    try {
      const licenses = await prisma.softwareLicense.findMany({
        where: orgFilter, take: 100,
        select: { softwareName: true, totalSeats: true, status: true, annualCost: true },
      });
      const totalSeats = licenses.reduce((s, l) => s + (l.totalSeats || 0), 0);
      const totalCost = licenses.reduce((s, l) => s + Number(l.annualCost || 0), 0);
      const active = licenses.filter((l) => l.status === "active").length;
      return {
        intent: "licenses_summary",
        response: `Software Licenses:\n• Total: ${licenses.length}\n• Active: ${active}\n• Total seats: ${totalSeats}\n• Annual cost: $${totalCost.toLocaleString()}`,
        navigate: [{ path: "/ict/licenses", label: "Open Licenses" }],
      };
    } catch (err) { logger.error(`Direct license query failed: ${err}`); }
  }

  return null;
}

// ─── Action handler (create ticket etc.) ─────────────────────

async function tryAction(message: string, accessToken?: string, userId?: string | null): Promise<{ intent: string; response: string; navigate?: NavLink[] } | null> {
  const lower = message.toLowerCase();

  if (lower.match(/create.*ticket|new.*ticket|open.*ticket|raise.*ticket|submit.*ticket|file.*ticket/)) {
    if (!accessToken) {
      return {
        intent: "create_ticket",
        response: "I can create tickets for you, but I need you to be signed in. Please submit one directly.",
        navigate: [{ path: "/me/tickets", label: "Submit a Ticket" }],
      };
    }
    const titleMatch = message.match(/(?:for|about|regarding)\s+(.+?)(?:\.|$)/i);
    const title = titleMatch ? titleMatch[1].trim() : "Issue reported via chatbot";
    const priority = lower.includes("urgent") || lower.includes("critical") ? "critical" : "medium";

    // Resolve the actual reporter from the JWT-bound user so the ticket shows
    // the requester's real name, not "Chatbot User".
    let reporterName = "Chatbot User";
    if (userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true, email: true },
        });
        if (user) {
          const full = `${user.firstName || ""} ${user.lastName || ""}`.trim();
          reporterName = full || user.email || reporterName;
        }
      } catch { /* fall back to default */ }
    }

    try {
      const res = await axios.post(`${BACKEND_URL}/ict/tickets`, {
        ticketNumber: `TKT-${Date.now().toString().slice(-5)}`,
        title,
        description: `Created via chatbot by ${reporterName}: ${message}`,
        category: "Software",
        priority,
        status: "open",
        reportedBy: reporterName,
      }, { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 });
      const ticket = res.data.data;
      return {
        intent: "create_ticket",
        response: `Created a new IT ticket:\n• Ticket: ${ticket?.ticketNumber || "Created"}\n• Title: ${title}\n• Reported by: ${reporterName}\n• Priority: ${priority}\n• Status: Open`,
        navigate: [{ path: "/ict/tickets", label: "View Tickets" }],
      };
    } catch (err) {
      logger.error(`Chatbot create ticket failed: ${err}`);
      return {
        intent: "create_ticket",
        response: `I tried to create a ticket but it failed. Please submit one manually.`,
        navigate: [{ path: "/me/tickets", label: "Submit Manually" }],
      };
    }
  }

  return null;
}

// ─── Session Management ───────────────────────────────────────

async function getOrCreateSession(sessionId: string | null, userId: string | null) {
  if (sessionId) {
    const existing = await prisma.chatbotSession.findUnique({ where: { id: sessionId } });
    if (existing) return existing;
  }

  return prisma.chatbotSession.create({
    data: { userId, metadata: {} },
  });
}

async function loadRecentMessages(sessionId: string, limit = 10): Promise<Array<{ role: string; content: string }>> {
  const rows = await prisma.chatbotMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { role: true, content: true },
  });
  return rows.reverse().map((r) => ({ role: r.role === "assistant" ? "assistant" : "user", content: r.content }));
}

// ─── Main Message Processing ──────────────────────────────────

async function processMessage(
  sessionId: string | null,
  userId: string | null,
  message: string,
  accessToken?: string,
  organizationId?: string,
): Promise<{ sessionId: string; intent: string | null; response: string; source?: "ai" | "rule-based"; navigate?: NavLink[] }> {
  const session = await getOrCreateSession(sessionId, userId);

  await prisma.chatbotMessage.create({
    data: { sessionId: session.id, role: "user", content: message },
  });

  // 1. Pending confirmation always wins
  const confirmationResult = handleConfirmation(session.id, message);
  if (confirmationResult) {
    let response: string;
    if (confirmationResult.startsWith("CONFIRMED:")) {
      const actionData = JSON.parse(confirmationResult.substring(10)) as PendingAction;
      try {
        if (accessToken) {
          await axios({
            method: actionData.method,
            url: `${BACKEND_URL}${actionData.endpoint}`,
            headers: { Authorization: `Bearer ${accessToken}` },
            data: actionData.data,
            timeout: 10000,
          });
          response = `Done! Successfully executed: **${actionData.description}**.`;
        } else {
          response = "I confirmed the action but couldn't execute it — no access token. Please try from the module directly.";
        }
      } catch (err) {
        logger.error(`Chatbot confirmed action failed: ${err}`);
        response = `I tried to execute the action but it failed. Please try it directly from the relevant module.`;
      }
    } else {
      response = confirmationResult;
    }
    await prisma.chatbotMessage.create({
      data: { sessionId: session.id, role: "assistant", content: response, intent: "confirmation" },
    });
    return { sessionId: session.id, intent: "confirmation", response };
  }

  // 2a. Preset library questions — exact-match deterministic router
  const preset = await tryPresetAnswer(message, organizationId);
  if (preset) {
    await prisma.chatbotMessage.create({
      data: { sessionId: session.id, role: "assistant", content: preset.response, intent: preset.intent, metadata: { source: "rule-based", navigate: preset.navigate } as Prisma.InputJsonValue },
    });
    return { sessionId: session.id, intent: preset.intent, response: preset.response, source: "rule-based", navigate: preset.navigate };
  }

  // 2b. Actions that mutate data (e.g., create ticket) — run before chat, never via Ollama
  const actionResult = await tryAction(message, accessToken, userId);
  if (actionResult) {
    await prisma.chatbotMessage.create({
      data: { sessionId: session.id, role: "assistant", content: actionResult.response, intent: actionResult.intent, metadata: { source: "rule-based", navigate: actionResult.navigate } as Prisma.InputJsonValue },
    });
    return { sessionId: session.id, intent: actionResult.intent, response: actionResult.response, source: "rule-based", navigate: actionResult.navigate };
  }

  // 3. Live data queries — precise answers from Postgres, no hallucinations
  const directResult = await directQuery(message, organizationId);
  if (directResult) {
    await prisma.chatbotMessage.create({
      data: { sessionId: session.id, role: "assistant", content: directResult.response, intent: directResult.intent, metadata: { source: "rule-based", navigate: directResult.navigate } as Prisma.InputJsonValue },
    });
    return { sessionId: session.id, intent: directResult.intent, response: directResult.response, source: "rule-based", navigate: directResult.navigate };
  }

  // 4. Fast navigation short-circuit — phrases like "take me to projects" or
  //    "go to hr" don't need an LLM round-trip. Match before Ollama for speed.
  const fastNav = ruleNavigation(message);
  if (fastNav) {
    await prisma.chatbotMessage.create({
      data: { sessionId: session.id, role: "assistant", content: fastNav.response, intent: "navigation", metadata: { source: "rule-based", navigate: fastNav.navigate } as Prisma.InputJsonValue },
    });
    return { sessionId: session.id, intent: "navigation", response: fastNav.response, source: "rule-based", navigate: fastNav.navigate };
  }

  // 5. Ollama — primary conversational path for free-form questions
  const history = await loadRecentMessages(session.id, 6);
  // Don't include the user's current message (we just saved it and pass it separately)
  const pastHistory = history.filter((_, idx) => idx < history.length - 1);
  const ollamaResult = await tryOllamaChat(message, pastHistory, organizationId);
  if (ollamaResult.success) {
    const { cleaned, navigate } = extractNavLinks(ollamaResult.response);
    await prisma.chatbotMessage.create({
      data: { sessionId: session.id, role: "assistant", content: cleaned, intent: "ollama_ai", metadata: { source: "ai", navigate } as Prisma.InputJsonValue },
    });
    return { sessionId: session.id, intent: "ollama_ai", response: cleaned, source: "ai", navigate: navigate.length > 0 ? navigate : undefined };
  }

  // 6. Navigation rule-based fallback (also runs if Ollama returned no useful text)
  const navResult = ruleNavigation(message);
  if (navResult) {
    await prisma.chatbotMessage.create({
      data: { sessionId: session.id, role: "assistant", content: navResult.response, intent: "navigation", metadata: { source: "rule-based", navigate: navResult.navigate } as Prisma.InputJsonValue },
    });
    return { sessionId: session.id, intent: "navigation", response: navResult.response, source: "rule-based", navigate: navResult.navigate };
  }

  // 6. Knowledge base / FAQ
  const kb = matchKnowledgeBase(message);
  if (kb) {
    await prisma.chatbotMessage.create({
      data: { sessionId: session.id, role: "assistant", content: kb.response, intent: "knowledge_base", metadata: { source: "rule-based", navigate: kb.navigate } as Prisma.InputJsonValue },
    });
    return { sessionId: session.id, intent: "knowledge_base", response: kb.response, source: "rule-based", navigate: kb.navigate };
  }

  // 7. Intent registry (legacy — configured in DB)
  const ruleResult = await enhancedMatchIntent(session.id, message, accessToken);
  await prisma.chatbotMessage.create({
    data: { sessionId: session.id, role: "assistant", content: ruleResult.response, intent: ruleResult.intent, metadata: { source: "rule-based" } as Prisma.InputJsonValue },
  });
  return { sessionId: session.id, intent: ruleResult.intent, response: ruleResult.response, source: "rule-based" };
}

// ─── Legacy intent registry ──────────────────────────────────

async function enhancedMatchIntent(
  sessionId: string,
  message: string,
  accessToken?: string
): Promise<{ intent: string | null; response: string }> {
  const intents = await prisma.chatbotIntent.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });

  if (intents.length === 0) {
    return {
      intent: null,
      response: "I'm not sure how to help with that. Try asking:\n• \"how many employees do we have?\"\n• \"show budget utilization\"\n• \"take me to projects\"\n• \"create an IT ticket for VPN issues\"\n\nOr ask me about any module — I have info on HR, Finance, Accounting, ICT, Projects, Workforce, Predictive, and Alerts.",
    };
  }

  const tokens = message.toLowerCase().split(/\s+/);
  const entities = extractEntities(message);
  let bestMatch: { intentName: string; score: number; responseType: string; responseData: Prisma.JsonValue } | null = null;

  for (const intent of intents) {
    const patterns = intent.patterns as string[];
    if (!Array.isArray(patterns)) continue;

    let score = 0;
    for (const pattern of patterns) {
      const patternWords = pattern.toLowerCase().split(/\s+/);

      if (message.toLowerCase().includes(pattern.toLowerCase())) {
        score += patternWords.length * 3 + intent.priority * 0.1;
        continue;
      }

      let wordMatches = 0;
      for (const pw of patternWords) {
        for (const t of tokens) {
          if (t.includes(pw) || pw.includes(t)) {
            wordMatches++;
          } else if (pw.length > 3 && t.length > 3 && levenshteinDistance(t, pw) <= 2) {
            wordMatches += 0.5;
          }
        }
      }
      const patternScore = wordMatches + intent.priority * 0.1;
      if (patternScore > score) score = patternScore;
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        intentName: intent.intentName,
        score,
        responseType: intent.responseType,
        responseData: intent.responseData,
      };
    }
  }

  if (!bestMatch) {
    return {
      intent: null,
      response: "I'm not sure how to help with that. Try asking:\n• \"how many employees do we have?\"\n• \"show budget utilization\"\n• \"take me to projects\"\n• \"create an IT ticket for VPN issues\"",
    };
  }

  const data = bestMatch.responseData as Record<string, unknown>;

  if ((bestMatch.responseType === "action") && data.requiresConfirmation) {
    const confirmMsg = buildConfirmationMessage(sessionId, bestMatch.intentName, data, entities);
    return { intent: bestMatch.intentName, response: confirmMsg };
  }

  if (bestMatch.responseType === "static") {
    return { intent: bestMatch.intentName, response: (data.text as string) || "No response configured." };
  }

  if (bestMatch.responseType === "api_query" && accessToken) {
    try {
      const endpoint = data.endpoint as string;
      const method = ((data.method as string) || "GET").toUpperCase();
      const res = await axios({
        method, url: `${BACKEND_URL}${endpoint}`,
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });
      const apiData = res.data.data;
      const format = data.format as string;
      return { intent: bestMatch.intentName, response: formatApiResponse(format, apiData) };
    } catch (err) {
      logger.error(`Chatbot API query failed: ${err}`);
      return { intent: bestMatch.intentName, response: `I tried to look that up but couldn't retrieve the data.` };
    }
  }

  if (bestMatch.responseType === "action" && accessToken) {
    try {
      const endpoint = data.endpoint as string;
      const method = ((data.method as string) || "POST").toUpperCase();
      await axios({
        method, url: `${BACKEND_URL}${endpoint}`,
        headers: { Authorization: `Bearer ${accessToken}` },
        data: entities,
        timeout: 10000,
      });
      return { intent: bestMatch.intentName, response: `Action completed: **${bestMatch.intentName}**` };
    } catch (err) {
      logger.error(`Chatbot action failed: ${err}`);
      return { intent: bestMatch.intentName, response: `The action couldn't be completed.` };
    }
  }

  return { intent: bestMatch.intentName, response: (data.text as string) || "I found a match but couldn't generate a response." };
}

// ─── Response Formatting ──────────────────────────────────────

function formatApiResponse(format: string, data: unknown): string {
  if (!data) return "No data available.";

  switch (format) {
    case "attrition_summary": {
      const d = data as Record<string, unknown>;
      return `Attrition: ${d.totalPredictions || 0} analyzed. ${d.highRisk || 0} high risk, ${d.mediumRisk || 0} medium, ${d.lowRisk || 0} low. Avg score: ${((d.avgRiskScore as number) * 100 || 0).toFixed(1)}%.`;
    }
    case "kpi_list": {
      const kpis = data as Array<{ name: string; currentValue: number; change: number }>;
      if (!Array.isArray(kpis) || kpis.length === 0) return "No KPIs available.";
      const lines = kpis.slice(0, 5).map((k) => `• ${k.name}: ${k.currentValue} (${k.change >= 0 ? "+" : ""}${k.change}%)`);
      return `Key Performance Indicators:\n${lines.join("\n")}`;
    }
    case "alert_list": {
      const alerts = data as Array<{ title: string; severity: string }>;
      if (!Array.isArray(alerts) || alerts.length === 0) return "No unread alerts.";
      const lines = alerts.slice(0, 5).map((a) => `• [${a.severity.toUpperCase()}] ${a.title}`);
      return `Recent Alerts:\n${lines.join("\n")}`;
    }
    case "budget_summary": {
      const d = data as Record<string, unknown>;
      return `Budget Summary (FY ${d.fiscalYear || "current"}): Allocated ${formatMoney(d.totalAllocated as number)}, Spent ${formatMoney(d.totalSpent as number)}, Remaining ${formatMoney(d.totalRemaining as number)}. Utilization: ${d.utilizationRate || 0}%.`;
    }
    case "project_summary": {
      const d = data as Record<string, unknown>;
      return `Projects: ${d.total || 0} total, avg progress ${d.avgProgress || 0}%.`;
    }
    case "ticket_summary": {
      const d = data as Record<string, unknown>;
      return `Tickets: ${d.total || 0} total. ${d.open || 0} open, ${d.inProgress || 0} in progress, ${d.resolved || 0} resolved.`;
    }
    case "forecast_summary": {
      const forecasts = data as Array<{ metric: string; predicted_value: number; target_date: string }>;
      if (!Array.isArray(forecasts) || forecasts.length === 0) return "No forecasts available.";
      const lines = forecasts.slice(0, 5).map((f) => `• ${f.metric}: ${f.predicted_value} (${f.target_date})`);
      return `Recent Forecasts:\n${lines.join("\n")}`;
    }
    default:
      return JSON.stringify(data).slice(0, 300);
  }
}

function formatMoney(val: number | undefined): string {
  if (!val) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

// ─── Session Queries ──────────────────────────────────────────

async function getSessionHistory(sessionId: string) {
  return prisma.chatbotMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
}

async function getSessions(userId?: string) {
  const where = userId ? { userId } : {};
  return prisma.chatbotSession.findMany({
    where,
    include: { _count: { select: { messages: true } } },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
}

async function getOllamaStatus(): Promise<{ available: boolean; model: string; url: string }> {
  try {
    const res = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 3000 });
    const models = res.data?.models || [];
    const hasModel = models.some((m: { name: string }) => m.name.startsWith(OLLAMA_MODEL));
    return { available: hasModel, model: OLLAMA_MODEL, url: OLLAMA_URL };
  } catch {
    return { available: false, model: OLLAMA_MODEL, url: OLLAMA_URL };
  }
}

const chatbotService = {
  processMessage,
  getSessionHistory,
  getSessions,
  getOllamaStatus,
};

export default chatbotService;
