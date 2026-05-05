import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody } from "../../components/ui/Card";
import { Send, Bot, User, Sparkles, Cpu, AlertCircle, ArrowRight, ChevronDown, ChevronRight, Compass, Users, DollarSign, Monitor, HardHat, BarChart3, HelpCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ChatMessage, ChatNavigationLink } from "../../types";
import api from "../../api/client";

type SuggestionCategory = {
  key: string;
  label: string;
  icon: LucideIcon;
  questions: string[];
};

const SUGGESTION_CATEGORIES: SuggestionCategory[] = [
  {
    key: "navigation",
    label: "Navigation",
    icon: Compass,
    questions: [
      "Take me to projects",
      "Open the dashboard",
      "Go to HR management",
      "Show me alerts",
      "Open accounting invoices",
      "Take me to the employee directory",
      "Open settings",
      "Open the admin panel",
    ],
  },
  {
    key: "hr",
    label: "HR & People",
    icon: Users,
    questions: [
      "How many employees do we have?",
      "Show pending leave requests",
      "Show me attrition risk",
      "How does attrition prediction work?",
      "What departments exist?",
      "How do I request leave?",
      "Show me the org chart",
    ],
  },
  {
    key: "finance",
    label: "Finance & Accounting",
    icon: DollarSign,
    questions: [
      "What's the budget utilization?",
      "Show outstanding invoices",
      "Where can I see overdue invoices?",
      "How do I create an invoice?",
      "Show me budget variance",
      "What's the chart of accounts?",
    ],
  },
  {
    key: "ict",
    label: "IT & Assets",
    icon: Monitor,
    questions: [
      "How many open IT tickets?",
      "Show critical tickets",
      "Create an IT ticket for VPN issues",
      "Show me IT asset summary",
      "How do I report an issue?",
      "Show software licenses",
    ],
  },
  {
    key: "projects",
    label: "Projects",
    icon: HardHat,
    questions: [
      "How many active projects?",
      "Show project status",
      "How do I request materials?",
      "How do I create a project?",
      "Show me suppliers",
    ],
  },
  {
    key: "insights",
    label: "Predictive & Analytics",
    icon: BarChart3,
    questions: [
      "What is the workforce satisfaction trend?",
      "Show me forecasts",
      "What ML models does SEP use?",
      "Show predictive analytics",
    ],
  },
  {
    key: "platform",
    label: "Platform & Help",
    icon: HelpCircle,
    questions: [
      "What is SEP?",
      "What can you do?",
      "How do I change my password?",
      "Toggle dark mode",
      "Who built SEP?",
      "Explain user roles",
    ],
  },
];

export default function Chatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your SEP assistant. I can answer questions, help you navigate the platform, fetch live data, and create IT tickets for you. What would you like to do?",
      intent: "greeting",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; model: string } | null>(null);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>("navigation");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get("/chatbot/status").then((res) => {
      setOllamaStatus(res.data.data);
    }).catch(() => {
      setOllamaStatus({ available: false, model: "unknown" });
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const pushAssistant = (content: string, intent: string | null, source?: "ai" | "rule-based", navigate?: ChatNavigationLink[]) => {
    setMessages((prev) => [...prev, {
      id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "assistant",
      content,
      intent,
      timestamp: new Date().toISOString(),
      source,
      navigate,
    }]);
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
      const res = await api.post("/chatbot/message", { sessionId, message: text });
      const data = res.data.data;
      if (data.sessionId && !sessionId) setSessionId(data.sessionId);

      pushAssistant(
        data.response || "Sorry, I didn't catch that.",
        data.intent || null,
        data.source,
        Array.isArray(data.navigate) ? data.navigate : undefined,
      );
    } catch {
      pushAssistant(
        "I couldn't reach the assistant service. Please check your connection and try again.",
        null,
        "rule-based",
      );
    } finally {
      setIsTyping(false);
    }
  };

  const renderMarkdownish = (text: string) => {
    // Render **bold** segments without introducing a full markdown parser.
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <PageWrapper title="AI Assistant" subtitle="Ask questions, navigate the platform, or perform actions">
      <div className="max-w-3xl mx-auto">
        {ollamaStatus && (
          <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-[10px] text-xs ${
            ollamaStatus.available
              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
              : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
          }`}>
            {ollamaStatus.available ? <Cpu size={14} /> : <AlertCircle size={14} />}
            {ollamaStatus.available
              ? `Ollama AI active (${ollamaStatus.model}) — rich LLM responses with live platform context`
              : `Ollama not detected — using rule-based navigation, live DB queries, and FAQ fallback.`}
          </div>
        )}
        <Card className="h-[calc(100vh-220px)] flex flex-col">
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
                  <div>{renderMarkdownish(msg.content)}</div>

                  {msg.role === "assistant" && msg.navigate && msg.navigate.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {msg.navigate.map((nav) => (
                        <Link
                          key={nav.path + nav.label}
                          to={nav.path}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[11px] font-medium bg-[#5B21B6] text-white hover:bg-[#7C3AED] transition-colors"
                        >
                          {nav.label}
                          <ArrowRight size={11} />
                        </Link>
                      ))}
                    </div>
                  )}

                  {msg.role === "assistant" && msg.source && (
                    <span className={`inline-block mt-1.5 ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                      msg.source === "ai"
                        ? "bg-[#5B21B6]/10 text-[#5B21B6] dark:bg-[#7C3AED]/20 dark:text-[#C4B5FD]"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      {msg.source === "ai" ? "AI" : "Rule-based"}
                    </span>
                  )}
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

          {showCategoryMenu && (
            <div className="px-5 py-3 border-t border-[#E8E4F3] dark:border-[#2E2850] max-h-[260px] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-[#D97706]" />
                  <span className="text-[10px] text-[#9B93B8] uppercase tracking-wide">Question library</span>
                </div>
                <button onClick={() => setShowCategoryMenu(false)} className="text-[10px] text-[#9B93B8] hover:text-[#5B21B6]">Hide</button>
              </div>
              <div className="space-y-1.5">
                {SUGGESTION_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isOpen = openCategory === cat.key;
                  return (
                    <div key={cat.key} className="rounded-[10px] border border-[#E8E4F3] dark:border-[#2E2850] overflow-hidden">
                      <button
                        onClick={() => setOpenCategory(isOpen ? null : cat.key)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left bg-[#F8F7FF] dark:bg-[#0E0B1F] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] transition-colors"
                      >
                        <Icon size={13} className="text-[#5B21B6]" />
                        <span className="text-xs font-medium text-[#1E1B2E] dark:text-[#EDE9FE] flex-1">{cat.label}</span>
                        <span className="text-[10px] text-[#9B93B8]">{cat.questions.length}</span>
                        {isOpen ? <ChevronDown size={13} className="text-[#9B93B8]" /> : <ChevronRight size={13} className="text-[#9B93B8]" />}
                      </button>
                      {isOpen && (
                        <div className="flex flex-wrap gap-2 p-2.5 bg-white dark:bg-[#16122E]">
                          {cat.questions.map((q) => (
                            <button
                              key={q}
                              onClick={() => setInput(q)}
                              className="px-3 py-1.5 rounded-[20px] text-xs bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6] hover:bg-[#5B21B6] hover:text-white transition-colors"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="px-5 py-4 border-t border-[#E8E4F3] dark:border-[#2E2850]">
            <div className="flex gap-2">
              <button
                onClick={() => setShowCategoryMenu((v) => !v)}
                title="Browse question library"
                className={`w-11 h-11 rounded-[12px] flex items-center justify-center transition-colors ${
                  showCategoryMenu
                    ? "bg-[#5B21B6] text-white"
                    : "bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6] hover:bg-[#5B21B6] hover:text-white"
                }`}
              >
                <Sparkles size={16} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask a question, navigate, or perform an action..."
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
