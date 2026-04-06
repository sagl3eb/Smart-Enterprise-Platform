import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";
import axios from "axios";

const BACKEND_URL = "http://localhost:3000/api/v1";

interface PendingAction {
  action: string;
  endpoint: string;
  method: string;
  data: Record<string, any>;
  description: string;
  expiresAt: number;
}

const pendingActions: Map<string, PendingAction> = new Map();

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

  // Extract names (capitalized words)
  const nameMatch = message.match(/(?:named?|called?|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  if (nameMatch) entities.name = nameMatch[1];

  // Extract email
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) entities.email = emailMatch[0];

  // Extract numbers/IDs
  const idMatch = message.match(/(?:#|id\s*[:=]?\s*)(\w+)/i);
  if (idMatch) entities.id = idMatch[1];

  // Extract department
  const deptMatch = message.match(/(?:department|dept)\s*[:=]?\s*(\w+)/i);
  if (deptMatch) entities.department = deptMatch[1];

  return entities;
}

// ─── Confirmation Flow ────────────────────────────────────────

function handleConfirmation(sessionId: string, message: string): string | null {
  const pending = pendingActions.get(sessionId);
  if (!pending) return null;

  // Clean up expired actions
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
    expiresAt: Date.now() + 120000, // 2 min expiry
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

// ─── Enhanced Knowledge Base ──────────────────────────────────

const enhancedKnowledgeBase: Array<{ keywords: string[]; response: string }> = [
  {
    keywords: ["what is sep", "what is smart enterprise", "about sep", "about this platform", "what does sep do"],
    response: "The **Smart Enterprise Platform (SEP)** is a comprehensive enterprise management system with 9 integrated modules:\n\n" +
      "1. **Dashboard** — Executive overview with KPIs\n" +
      "2. **HR Management** — Employee records, departments, leave management\n" +
      "3. **Finance** — Budgets, transactions, variance analysis\n" +
      "4. **Accounting** — Invoices, journal entries, trial balance\n" +
      "5. **ICT Management** — IT tickets, assets, SLA tracking\n" +
      "6. **Construction Logistics** — Project management, milestones\n" +
      "7. **Workforce Analytics** — Attrition risk, department insights\n" +
      "8. **Predictive Analytics** — ML-powered forecasting and predictions\n" +
      "9. **Alerts** — Automated threshold-based notifications\n\n" +
      "It also includes an AI chatbot (that's me!) and role-based access control.",
  },
  {
    keywords: ["how does attrition work", "how does prediction work", "how does ml work", "machine learning explain"],
    response: "The **Attrition Prediction** system uses machine learning to estimate employee flight risk:\n\n" +
      "• **Models**: Random Forest, Gradient Boosting, and Logistic Regression\n" +
      "• **Dataset**: 56,599 employee records with 22 features\n" +
      "• **Features**: Age, salary, overtime, satisfaction, performance, tenure, etc.\n" +
      "• **Output**: Risk score (0-1), risk level (Low/Medium/High), top contributing factors\n\n" +
      "Train or retrain models from the Predictive Analytics module.",
  },
  {
    keywords: ["how to use", "getting started", "tutorial", "how do i start", "first time"],
    response: "**Getting Started with SEP:**\n\n" +
      "1. Use the **Dashboard** for a quick overview of your organization\n" +
      "2. Navigate to specific modules using the sidebar\n" +
      "3. Ask me questions anytime using this chat!\n\n" +
      "**Quick tips:**\n" +
      "• You can ask me to look up data (e.g., 'show open tickets')\n" +
      "• I can perform actions (e.g., 'create a ticket')\n" +
      "• Use the Predictive Analytics module for ML-powered insights\n" +
      "• Check Alerts for automated notifications about anomalies",
  },
  {
    keywords: ["who built", "who made", "developer", "author", "created by"],
    response: "SEP was developed by **Saqqaf Al-Yazidi (TP075880)** as a Final Year Project (FYP). It demonstrates a full-stack enterprise platform with integrated ML capabilities.",
  },
  {
    keywords: ["thank", "thanks", "good job", "well done", "great"],
    response: "You're welcome! Happy to help. Let me know if there's anything else you need.",
  },
  {
    keywords: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"],
    response: "Hello! I'm the SEP Assistant. I can help you with:\n• Looking up data across all modules\n• Performing actions like creating tickets or employees\n• Answering questions about the platform\n\nWhat would you like to do?",
  },
];

function matchKnowledgeBase(message: string): string | null {
  const lower = message.toLowerCase();
  let bestMatch: { response: string; score: number } | null = null;

  for (const entry of enhancedKnowledgeBase) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (lower.includes(keyword)) {
        score += keyword.split(/\s+/).length; // multi-word matches score higher
      }
    }
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { response: entry.response, score };
    }
  }

  return bestMatch ? bestMatch.response : null;
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

// ─── Main Message Processing ──────────────────────────────────

async function processMessage(
  sessionId: string | null,
  userId: string | null,
  message: string,
  accessToken?: string
): Promise<{ sessionId: string; intent: string | null; response: string }> {
  const session = await getOrCreateSession(sessionId, userId);

  // Save user message
  await prisma.chatbotMessage.create({
    data: { sessionId: session.id, role: "user", content: message },
  });

  // Check for pending confirmation FIRST
  const confirmationResult = handleConfirmation(session.id, message);
  if (confirmationResult) {
    let intent: string | null = "confirmation";
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
          response = `Done! Successfully executed: **${actionData.description}**. The action has been completed.`;
        } else {
          response = "I confirmed the action but couldn't execute it — no access token available. Please try from the module directly.";
        }
      } catch (err) {
        logger.error(`Chatbot confirmed action failed: ${err}`);
        response = `I tried to execute the action but it failed. Please try performing this action directly from the relevant module.`;
      }
    } else {
      response = confirmationResult;
    }

    await prisma.chatbotMessage.create({
      data: { sessionId: session.id, role: "assistant", content: response, intent },
    });

    return { sessionId: session.id, intent, response };
  }

  // Enhanced intent matching
  const { intent, response } = await enhancedMatchIntent(session.id, message, accessToken);

  // Save bot response
  await prisma.chatbotMessage.create({
    data: { sessionId: session.id, role: "assistant", content: response, intent },
  });

  return { sessionId: session.id, intent, response };
}

// ─── Enhanced Intent Matching ─────────────────────────────────

async function enhancedMatchIntent(
  sessionId: string,
  message: string,
  accessToken?: string
): Promise<{ intent: string | null; response: string }> {
  const intents = await prisma.chatbotIntent.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });

  const tokens = message.toLowerCase().split(/\s+/);
  const entities = extractEntities(message);
  let bestMatch: { intentName: string; score: number; responseType: string; responseData: Prisma.JsonValue } | null = null;

  for (const intent of intents) {
    const patterns = intent.patterns as string[];
    if (!Array.isArray(patterns)) continue;

    let score = 0;
    for (const pattern of patterns) {
      const patternWords = pattern.toLowerCase().split(/\s+/);

      // Exact phrase match (highest weight)
      if (message.toLowerCase().includes(pattern.toLowerCase())) {
        score += patternWords.length * 3 + intent.priority * 0.1;
        continue;
      }

      // Word-level matching with fuzzy support
      let wordMatches = 0;
      for (const pw of patternWords) {
        for (const t of tokens) {
          if (t.includes(pw) || pw.includes(t)) {
            wordMatches++;
          } else if (pw.length > 3 && t.length > 3 && levenshteinDistance(t, pw) <= 2) {
            wordMatches += 0.5; // fuzzy match scores lower
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

  // If no intent matched, try knowledge base fallback
  if (!bestMatch) {
    const kbResponse = matchKnowledgeBase(message);
    if (kbResponse) {
      return { intent: "knowledge_base", response: kbResponse };
    }
    return {
      intent: null,
      response: "I'm not sure how to help with that. Try asking about employees, budgets, projects, tickets, KPIs, alerts, or forecasts. You can also type **help** to see what I can do!",
    };
  }

  const data = bestMatch.responseData as Record<string, unknown>;

  // Handle actions that require confirmation
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
      const formatted = formatApiResponse(format, apiData);
      return { intent: bestMatch.intentName, response: formatted };
    } catch (err) {
      logger.error(`Chatbot API query failed: ${err}`);
      return { intent: bestMatch.intentName, response: `I tried to look that up but couldn't retrieve the data. Try accessing the ${bestMatch.intentName.replace("_query", "")} module directly.` };
    }
  }

  // Action without confirmation
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
      return { intent: bestMatch.intentName, response: `Action completed successfully: **${bestMatch.intentName}**` };
    } catch (err) {
      logger.error(`Chatbot action failed: ${err}`);
      return { intent: bestMatch.intentName, response: `The action couldn't be completed. Please try it directly from the relevant module.` };
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
      return `Attrition Summary: ${d.totalPredictions || 0} employees analyzed. ${d.highRisk || 0} high risk, ${d.mediumRisk || 0} medium risk, ${d.lowRisk || 0} low risk. Average risk score: ${((d.avgRiskScore as number) * 100 || 0).toFixed(1)}%.`;
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
      return `Project Summary: ${d.total || 0} total projects, average progress ${d.avgProgress || 0}%. Total budget: ${formatMoney(d.totalEstimatedBudget as number)}.`;
    }
    case "ticket_summary": {
      const d = data as Record<string, unknown>;
      return `IT Ticket Summary: ${d.total || 0} total tickets. ${d.open || 0} open, ${d.inProgress || 0} in progress, ${d.resolved || 0} resolved. Average resolution: ${d.avgResolutionHours || 0} hours.`;
    }
    case "forecast_summary": {
      const forecasts = data as Array<{ metric: string; predicted_value: number; target_date: string }>;
      if (!Array.isArray(forecasts) || forecasts.length === 0) return "No forecasts available. Generate one from the Predictive Analytics module.";
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

const chatbotService = {
  processMessage,
  getSessionHistory,
  getSessions,
};

export default chatbotService;
