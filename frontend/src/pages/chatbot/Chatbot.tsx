import { useState, useRef, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody } from "../../components/ui/Card";
import { Send, Bot, User, Sparkles } from "lucide-react";
import type { ChatMessage } from "../../types";
import api from "../../api/client";

const SUGGESTIONS = [
  "How many employees do we have?",
  "Show me attrition risk summary",
  "Create an IT ticket for VPN issues",
  "What's the budget utilization?",
  "Show active projects",
  "How many open tickets are there?",
  "What are the latest alerts?",
  "Generate a revenue forecast",
];

// Comprehensive local knowledge base for when backend is unavailable
const KNOWLEDGE_BASE: Array<{ patterns: string[]; response: string; action?: () => Promise<string> }> = [];

export default function Chatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your SEP assistant. I can answer questions about all modules and perform actions like creating tickets, checking budgets, viewing employees, and more. What would you like to do?",
      intent: "greeting",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addBotMessage = (content: string, intent?: string) => {
    setMessages((prev) => [...prev, {
      id: `bot-${Date.now()}`,
      role: "assistant" as const,
      content,
      intent: intent || null,
      timestamp: new Date().toISOString(),
    }]);
  };

  const tryApiAction = async (text: string): Promise<string | null> => {
    const lower = text.toLowerCase();

    // ── Create IT ticket action ────────────────────────────
    if (lower.match(/create.*ticket|new.*ticket|open.*ticket|raise.*ticket|submit.*ticket/)) {
      const titleMatch = text.match(/(?:for|about|regarding)\s+(.+?)(?:\.|$)/i);
      const title = titleMatch ? titleMatch[1].trim() : "Issue reported via chatbot";
      try {
        const res = await api.post("/ict/tickets", {
          ticketNumber: `TKT-${Date.now().toString().slice(-5)}`,
          title,
          description: `Created via chatbot: ${text}`,
          category: "Software",
          priority: lower.includes("urgent") || lower.includes("critical") ? "critical" : "medium",
          status: "open",
          reportedBy: "Chatbot User",
        });
        const ticket = res.data.data;
        return `I've created a new IT ticket:\n• Ticket: ${ticket.ticketNumber || "Created"}\n• Title: ${title}\n• Priority: ${lower.includes("urgent") ? "Critical" : "Medium"}\n• Status: Open\n\nYou can view it in the ICT Tickets module.`;
      } catch {
        return `I tried to create a ticket but the request failed. Please create it manually in ICT → Tickets.`;
      }
    }

    // ── Fetch employee count ───────────────────────────────
    if (lower.match(/how many.*(employee|staff|people|worker)|employee.*count|headcount|total.*employee/)) {
      try {
        const res = await api.get("/hr/stats");
        const s = res.data.data;
        return `Here's the employee summary:\n• Total employees: ${s.totalEmployees || 0}\n• Active: ${s.activeEmployees || 0}\n• Departments: ${s.departmentCount || 0}\n• Average salary: $${Math.round(s.averageSalary || 0).toLocaleString()}\n• Pending leaves: ${s.pendingLeaves || 0}`;
      } catch { return null; }
    }

    // ── Fetch budget info ──────────────────────────────────
    if (lower.match(/budget|spending|utilization|allocation|financial.*summary/)) {
      try {
        const res = await api.get("/finance/budgets/summary");
        const b = res.data.data;
        return `Budget Summary (FY ${b.fiscalYear || new Date().getFullYear()}):\n• Total Allocated: $${(b.totalAllocated || 0).toLocaleString()}\n• Total Spent: $${(b.totalSpent || 0).toLocaleString()}\n• Remaining: $${(b.totalRemaining || 0).toLocaleString()}\n• Utilization: ${b.utilizationRate || 0}%\n• Categories: ${b.categoryCount || 0}`;
      } catch { return null; }
    }

    // ── Fetch open tickets ─────────────────────────────────
    if (lower.match(/open.*ticket|ticket.*open|how many.*ticket|ticket.*count|ticket.*status/)) {
      try {
        const res = await api.get("/ict/tickets?status=open&limit=5");
        const tickets = res.data.data || [];
        const total = res.data.meta?.total || tickets.length;
        let response = `There are ${total} open IT tickets.`;
        if (tickets.length > 0) {
          response += "\n\nLatest open tickets:";
          tickets.slice(0, 5).forEach((t: { ticketNumber: string; title: string; priority: string }) => {
            response += `\n• [${t.priority.toUpperCase()}] ${t.ticketNumber}: ${t.title}`;
          });
        }
        return response;
      } catch { return null; }
    }

    // ── Fetch active projects ──────────────────────────────
    if (lower.match(/active.*project|project.*active|project.*status|show.*project|list.*project|how many.*project/)) {
      try {
        const res = await api.get("/construction/projects?status=active&limit=5");
        const projects = res.data.data || [];
        let response = `Active projects: ${projects.length}`;
        if (projects.length > 0) {
          response += "\n";
          projects.forEach((p: { code: string; name: string; progress: number; status: string }) => {
            response += `\n• ${p.code}: ${p.name} — ${p.progress}% complete`;
          });
        }
        return response;
      } catch { return null; }
    }

    // ── Fetch alerts ───────────────────────────────────────
    if (lower.match(/alert|notification|warning|unread/)) {
      try {
        const res = await api.get("/alerts?isRead=false&limit=5");
        const alerts = res.data.data || [];
        if (alerts.length === 0) return "No unread alerts at the moment. Everything looks good!";
        let response = `${alerts.length} unread alert(s):`;
        alerts.forEach((a: { severity: string; title: string; module: string }) => {
          response += `\n• [${a.severity.toUpperCase()}] ${a.title} (${a.module})`;
        });
        return response;
      } catch { return null; }
    }

    // ── Attrition risk ─────────────────────────────────────
    if (lower.match(/attrition|turnover|risk|retention|leave.*rate/)) {
      try {
        const res = await api.get("/workforce/attrition/summary");
        const s = res.data.data;
        return `Attrition Risk Summary:\n• Total analyzed: ${s.totalPredictions || 0} employees\n• High risk: ${s.highRisk || 0}\n• Medium risk: ${s.mediumRisk || 0}\n• Low risk: ${s.lowRisk || 0}\n• Average risk score: ${((s.avgRiskScore || 0) * 100).toFixed(1)}%\n\nVisit Workforce Analytics for the full breakdown.`;
      } catch { return null; }
    }

    // ── Invoice summary ────────────────────────────────────
    if (lower.match(/invoice|outstanding|overdue|payment.*due|accounts.*receivable/)) {
      try {
        const res = await api.get("/accounting/invoices?limit=5");
        const invoices = res.data.data || [];
        const total = invoices.reduce((s: number, i: { totalAmount: number }) => s + i.totalAmount, 0);
        const paid = invoices.reduce((s: number, i: { paidAmount: number }) => s + i.paidAmount, 0);
        const overdue = invoices.filter((i: { status: string }) => i.status === "overdue").length;
        return `Invoice Summary:\n• Total invoiced: $${total.toLocaleString()}\n• Total paid: $${paid.toLocaleString()}\n• Outstanding: $${(total - paid).toLocaleString()}\n• Overdue: ${overdue} invoice(s)\n\nVisit Accounting → Invoices for details.`;
      } catch { return null; }
    }

    // ── IT assets ──────────────────────────────────────────
    if (lower.match(/asset|hardware|laptop|computer|inventory.*it|it.*inventory/)) {
      try {
        const res = await api.get("/ict/assets?limit=100");
        const assets = res.data.data || [];
        const totalVal = assets.reduce((s: number, a: { purchasePrice?: number }) => s + (a.purchasePrice || 0), 0);
        const active = assets.filter((a: { status: string }) => a.status === "active").length;
        return `IT Asset Summary:\n• Total assets: ${assets.length}\n• Active: ${active}\n• Total value: $${totalVal.toLocaleString()}\n\nVisit ICT → Assets for full inventory.`;
      } catch { return null; }
    }

    return null;
  };

  const getLocalResponse = (text: string): string => {
    const lower = text.toLowerCase();

    // Greetings
    if (lower.match(/^(hello|hi|hey|good morning|good afternoon|good evening|sup|yo)\b/))
      return "Hello! I'm your SEP assistant. I can help with HR data, budgets, projects, tickets, invoices, alerts, forecasts, and more. What would you like to know?";

    // What can you do
    if (lower.match(/what can you do|help|features|capabilities|how.*help/))
      return "I can help you with:\n\n📊 **Data Queries**: Employee count, budget status, project progress, ticket stats, invoice summaries, attrition risk\n\n🎫 **Actions**: Create IT tickets, check alerts, view active projects\n\n📈 **Analytics**: Attrition predictions, satisfaction trends, forecasting\n\n🔍 **Navigation**: I can point you to any module or page\n\nJust ask me anything about your enterprise data!";

    // Module navigation
    if (lower.match(/where.*employee|find.*employee|go.*hr/))
      return "You can manage employees at **HR Management** (click HR in the sidebar). There you can view, create, edit, and manage all employee records, departments, and leave requests.";
    if (lower.match(/where.*budget|find.*budget|go.*finance/))
      return "Budget information is in **Finance** (sidebar). You'll see budget allocation, spending by category, and can create new budgets.";
    if (lower.match(/where.*ticket|find.*ticket|go.*ict/))
      return "IT Tickets are in **ICT Management → Tickets** (sidebar). You can create, track, and resolve tickets there.";
    if (lower.match(/where.*invoice|find.*invoice|go.*accounting/))
      return "Invoices are in **Accounting** (sidebar). You can create invoices with line items, record payments, and track status.";
    if (lower.match(/where.*project|find.*project/))
      return "Projects are in the **Projects** module (sidebar). You can track progress, update milestones, and manage budgets.";
    if (lower.match(/where.*setting|find.*setting|change.*password|change.*theme/))
      return "Go to **Settings** (bottom of sidebar). You can update your profile, change password, toggle dark mode, and if you're an admin — manage users and organizations.";

    // Platform info
    if (lower.match(/what is sep|about.*sep|about.*platform|what.*platform/))
      return "SEP (Smart Enterprise Platform) is an AI-powered enterprise management system with 9 modules: HR, Finance, Accounting, ICT, Projects, Workforce Analytics, Predictive Analytics, Alerts, and Dashboard. It features ML-based attrition prediction, forecasting, and anomaly detection.";
    if (lower.match(/how many module|what.*module|list.*module/))
      return "SEP has 9 core modules:\n1. Dashboard & KPIs\n2. HR Management\n3. Finance\n4. Accounting\n5. ICT Management\n6. Projects\n7. Workforce Analytics\n8. Predictive Analytics\n9. Alerts & Optimization\n\nPlus: AI Chatbot, Settings, and User Management.";
    if (lower.match(/admin|role|permission|access/))
      return "SEP has 5 roles: Super Admin, Admin, Manager, Employee, and Viewer. Admins can switch between Admin View (oversight dashboards) and Employee View (operational CRUD) using the toggle in the top bar. Module access is controlled per-organization.";
    if (lower.match(/dark mode|theme|appearance/))
      return "You can toggle dark mode in Settings → Appearance, or click the moon/sun icon in the top bar.";

    // Forecast/ML
    if (lower.match(/forecast|predict|ml.*model|machine learning|train/))
      return "The Predictive Analytics module offers:\n• **Attrition Prediction**: Random Forest model trained on 1,470 employee records\n• **Forecasting**: Prophet/Linear Regression for revenue, headcount, budget trends\n• **Anomaly Detection**: Isolation Forest for system health monitoring\n\nGo to Predictive Analytics → click 'Generate Forecast' to see predictions.";

    // Thanks/bye
    if (lower.match(/thank|thanks|bye|goodbye|see you|cheers/))
      return "You're welcome! Feel free to ask anytime. Have a great day! 👋";

    // Default
    return "I'm not sure I understand that specific request. Try asking about:\n• Employee data or HR stats\n• Budget or financial info\n• IT tickets or assets\n• Project status\n• Alerts and notifications\n• Invoices and payments\n• Attrition risk or predictions\n\nOr ask me to create a ticket!";
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      intent: null,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      // Try backend chatbot first
      const res = await api.post("/chatbot/message", { sessionId, message: text });
      const data = res.data.data;
      if (data.sessionId && !sessionId) setSessionId(data.sessionId);

      if (data.response && data.response !== "I'm not sure how to help with that.") {
        addBotMessage(data.response, data.intent);
        setIsTyping(false);
        return;
      }
    } catch {
      // Backend unavailable — continue with local handling
    }

    // Try API action (create ticket, fetch data, etc.)
    try {
      const actionResult = await tryApiAction(text);
      if (actionResult) {
        addBotMessage(actionResult);
        setIsTyping(false);
        return;
      }
    } catch {
      // API action failed — fall through
    }

    // Fall back to local knowledge base
    const localResponse = getLocalResponse(text);
    addBotMessage(localResponse);
    setIsTyping(false);
  };

  return (
    <PageWrapper title="AI Assistant" subtitle="Ask questions or perform actions across all modules">
      <div className="max-w-3xl mx-auto">
        <Card className="h-[calc(100vh-220px)] flex flex-col">
          {/* Messages */}
          <CardBody className="flex-1 overflow-y-auto space-y-4 pb-0">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                  msg.role === "user" ? "bg-[#5B21B6] text-white" : "bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6]"
                }`}>
                  {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className={`max-w-[80%] rounded-[14px] px-4 py-3 text-sm whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-[#5B21B6] text-white"
                    : "bg-[#F8F7FF] dark:bg-[#0E0B1F] text-[#1E1B2E] dark:text-[#EDE9FE] border border-[#E8E4F3] dark:border-[#2E2850]"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#EDE9FE] dark:bg-[#2D1F5E] flex items-center justify-center text-[#5B21B6]">
                  <Bot size={14} />
                </div>
                <div className="bg-[#F8F7FF] dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850] rounded-[14px] px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#9B93B8] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-[#9B93B8] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-[#9B93B8] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardBody>

          {/* Suggestions */}
          {messages.length <= 2 && (
            <div className="px-5 py-3 border-t border-[#E8E4F3] dark:border-[#2E2850]">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={12} className="text-[#D97706]" />
                <span className="text-[10px] text-[#9B93B8]">Try asking</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => setInput(s)}
                    className="px-3 py-1.5 rounded-[20px] text-xs bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6] hover:bg-[#5B21B6] hover:text-white transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-5 py-4 border-t border-[#E8E4F3] dark:border-[#2E2850]">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask a question or perform an action..."
                className="flex-1 px-4 py-3 rounded-[12px] text-sm bg-[#F8F7FF] dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30"
              />
              <button onClick={sendMessage} disabled={!input.trim() || isTyping}
                className="w-11 h-11 rounded-[12px] bg-[#5B21B6] hover:bg-[#7C3AED] disabled:opacity-40 flex items-center justify-center text-white transition-colors">
                <Send size={16} />
              </button>
            </div>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
}
