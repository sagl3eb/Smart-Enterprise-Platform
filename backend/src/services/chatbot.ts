import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";
import axios from "axios";

const BACKEND_URL = "http://localhost:3000/api/v1";

async function getOrCreateSession(sessionId: string | null, userId: string | null) {
  if (sessionId) {
    const existing = await prisma.chatbotSession.findUnique({ where: { id: sessionId } });
    if (existing) return existing;
  }

  return prisma.chatbotSession.create({
    data: { userId, metadata: {} },
  });
}

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

  // Match intent
  const { intent, response } = await matchIntent(message, accessToken);

  // Save bot response
  await prisma.chatbotMessage.create({
    data: { sessionId: session.id, role: "assistant", content: response, intent },
  });

  return { sessionId: session.id, intent, response };
}

async function matchIntent(
  message: string,
  accessToken?: string
): Promise<{ intent: string | null; response: string }> {
  const intents = await prisma.chatbotIntent.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });

  const tokens = message.toLowerCase().split(/\s+/);
  let bestMatch: { intentName: string; score: number; responseType: string; responseData: Prisma.JsonValue } | null = null;

  for (const intent of intents) {
    const patterns = intent.patterns as string[];
    if (!Array.isArray(patterns)) continue;

    let score = 0;
    for (const pattern of patterns) {
      const patternWords = pattern.toLowerCase().split(/\s+/);
      for (const pw of patternWords) {
        if (tokens.some((t) => t.includes(pw) || pw.includes(t))) {
          score += 1 + intent.priority * 0.1;
        }
      }
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
      response: "I'm not sure how to help with that. Try asking about employees, budgets, projects, tickets, KPIs, alerts, or forecasts.",
    };
  }

  const data = bestMatch.responseData as Record<string, unknown>;

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

  return { intent: bestMatch.intentName, response: (data.text as string) || "I found a match but couldn't generate a response." };
}

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
