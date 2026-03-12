import { useState, useRef, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody } from "../../components/ui/Card";
import { Send, Bot, User, Sparkles } from "lucide-react";
import type { ChatMessage } from "../../types";
import api from "../../api/client";

const SUGGESTIONS = [
  "What are the current KPIs?",
  "Show me attrition risk summary",
  "How many open IT tickets?",
  "What's the budget utilization?",
  "List active construction projects",
  "Show recent alerts",
];

export default function Chatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your Nexus assistant. I can help you with HR queries, financial data, project updates, IT tickets, KPIs, alerts, and forecasts. What would you like to know?",
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
      const res = await api.post("/chatbot/message", {
        sessionId,
        message: text,
      });

      const data = res.data.data;
      if (data.sessionId && !sessionId) setSessionId(data.sessionId);

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: data.response || data.message || "I received your message but couldn't process it.",
        intent: data.intent || null,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      // Fallback rule-based response
      const response = getLocalResponse(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: response,
          intent: null,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const getLocalResponse = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.match(/hello|hi|hey|good morning/)) return "Hello! How can I help you today? I can assist with HR, finance, projects, IT tickets, and more.";
    if (lower.match(/kpi|metric|dashboard/)) return "You can view all KPIs on the Dashboard page. Current metrics include employee count, budget utilization, open tickets, and active projects. Navigate to /dashboard for the full view.";
    if (lower.match(/attrition|turnover|risk|retention/)) return "The Workforce Analytics module tracks attrition risk. Currently monitoring all active employees with our ML model. Visit /workforce/attrition for the detailed risk dashboard.";
    if (lower.match(/ticket|support|it issue/)) return "The ICT module manages IT tickets. You can view open, in-progress, and resolved tickets at /ict/tickets. Use the filters to find specific issues.";
    if (lower.match(/budget|spending|expense|finance/)) return "Budget information is available in the Finance module. Visit /finance/budget for the full breakdown of allocated vs spent amounts across all categories.";
    if (lower.match(/project|construction|milestone/)) return "Construction projects are tracked at /construction. You can view progress, milestones, tasks, and material requests for each project.";
    if (lower.match(/alert|notification|warning/)) return "Recent alerts are available at /alerts. You can filter by severity, mark as read, and manage alert rules.";
    if (lower.match(/forecast|predict|future/)) return "The Predictive Analytics module offers ML-powered forecasting. Visit /predictive to generate revenue, headcount, and budget forecasts.";
    if (lower.match(/help|what can you do|feature/)) return "I can help with: employee information, leave status, budget data, project updates, IT tickets, KPIs, alerts, and ML forecasts. Just ask me a question!";
    if (lower.match(/bye|goodbye|thanks|thank you/)) return "You're welcome! Feel free to come back anytime. Have a great day!";
    return "I understood your question but I'm not sure how to help with that specific topic. Try asking about employees, budgets, projects, tickets, KPIs, or forecasts.";
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
  };

  return (
    <PageWrapper title="AI Assistant" subtitle="Chatbot — Ask questions about your enterprise data">
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
                <div className={`max-w-[80%] rounded-[14px] px-4 py-3 text-sm ${
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
                <span className="text-[10px] text-[#9B93B8]">Suggested questions</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => handleSuggestion(s)}
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
                placeholder="Ask about your enterprise data..."
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
