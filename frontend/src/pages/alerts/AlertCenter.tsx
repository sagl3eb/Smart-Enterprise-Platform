import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Bell, Plus, Check, CheckCheck, Eye, Shield, Lightbulb, Filter } from "lucide-react";
import { formatRelativeTime, severityColor } from "../../utils/formatters";
import api from "../../api/client";
import useAlertStore from "../../store/alertStore";
import type { Alert, AlertRule, OptimizationSuggestion } from "../../types";

type Tab = "feed" | "rules" | "suggestions";

export default function AlertCenter() {
  const [tab, setTab] = useState<Tab>("feed");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState("");
  const { setUnreadCount } = useAlertStore();

  useEffect(() => { fetchData(); }, [tab, severityFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === "feed") {
        const params = new URLSearchParams({ limit: "30" });
        if (severityFilter) params.set("severity", severityFilter);
        const res = await api.get(`/alerts?${params}`);
        setAlerts(res.data.data || []);
      } else if (tab === "rules") {
        const res = await api.get("/alerts/rules");
        setRules(res.data.data || []);
      } else {
        const res = await api.get("/alerts/suggestions");
        setSuggestions(res.data.data || []);
      }
    } catch {
      if (tab === "feed") {
        setAlerts([
          { id: "1", ruleId: null, title: "High CPU usage on DB server", message: "PostgreSQL server CPU at 95% for over 2 hours", severity: "critical", module: "ict", isRead: false, isResolved: false, metadata: null, createdAt: "2024-12-14T08:30:00Z", resolvedAt: null },
          { id: "2", ruleId: null, title: "Budget utilization warning", message: "Marketing budget at 85% with 3 months remaining", severity: "high", module: "finance", isRead: false, isResolved: false, metadata: null, createdAt: "2024-12-14T07:00:00Z", resolvedAt: null },
          { id: "3", ruleId: null, title: "5 leave requests pending", message: "Leave requests awaiting manager approval", severity: "medium", module: "hr", isRead: true, isResolved: false, metadata: null, createdAt: "2024-12-13T16:00:00Z", resolvedAt: null },
          { id: "4", ruleId: null, title: "Project deadline approaching", message: "Highway Bridge project milestone due in 5 days", severity: "medium", module: "construction", isRead: true, isResolved: false, metadata: null, createdAt: "2024-12-13T10:00:00Z", resolvedAt: null },
          { id: "5", ruleId: null, title: "3 employees flagged high attrition risk", message: "Sales department has 3 employees with risk score > 0.7", severity: "high", module: "workforce", isRead: false, isResolved: false, metadata: null, createdAt: "2024-12-14T06:00:00Z", resolvedAt: null },
        ]);
      } else if (tab === "rules") {
        setRules([
          { id: "1", name: "High CPU Alert", module: "ict", metric: "cpu_usage", condition: "gt", threshold: 90, severity: "critical", isActive: true, cooldownMin: 30, lastTriggered: "2024-12-14T08:30:00Z" },
          { id: "2", name: "Budget Overrun Warning", module: "finance", metric: "budget_utilization", condition: "gt", threshold: 80, severity: "high", isActive: true, cooldownMin: 1440, lastTriggered: "2024-12-14T07:00:00Z" },
          { id: "3", name: "High Attrition Risk", module: "workforce", metric: "high_risk_employees", condition: "gt", threshold: 5, severity: "high", isActive: true, cooldownMin: 60, lastTriggered: null },
          { id: "4", name: "Open Tickets Backlog", module: "ict", metric: "open_tickets", condition: "gt", threshold: 20, severity: "medium", isActive: true, cooldownMin: 120, lastTriggered: null },
        ]);
      } else {
        setSuggestions([
          { id: "1", module: "hr", title: "Implement flexible work hours", description: "Departments with high overtime correlate with lower satisfaction. Flexible scheduling could reduce attrition risk by 15%.", impact: "high", effort: "medium", status: "pending" },
          { id: "2", module: "finance", title: "Reallocate contingency budget", description: "Contingency fund has 67% remaining. Consider reallocating to Marketing which is at 85% utilization.", impact: "medium", effort: "low", status: "pending" },
          { id: "3", module: "ict", title: "Upgrade DB server capacity", description: "Frequent CPU alerts suggest the database server needs scaling. Consider vertical scaling or read replicas.", impact: "high", effort: "high", status: "in_progress" },
        ]);
      }
    } finally { setLoading(false); }
  };

  const markRead = async (id: string) => {
    try {
      await api.put(`/alerts/${id}/read`);
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, isRead: true } : a));
      setUnreadCount(alerts.filter((a) => !a.isRead && a.id !== id).length);
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await api.put("/alerts/read-all", {});
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const unreadCount = alerts.filter((a) => !a.isRead).length;
  const criticalCount = alerts.filter((a) => a.severity === "critical" && !a.isResolved).length;
  const severityDot: Record<string, string> = { critical: "bg-red-500", high: "bg-orange-500", medium: "bg-yellow-500", low: "bg-blue-500", info: "bg-gray-400" };

  return (
    <PageWrapper title="Alert Center" subtitle="Alerts & Optimization">
      <div className="flex gap-2 mb-6 border-b border-[#E8E4F3] dark:border-[#2E2850] pb-3">
        {([{ key: "feed" as Tab, label: "Alert Feed", icon: Bell }, { key: "rules" as Tab, label: "Alert Rules", icon: Shield }, { key: "suggestions" as Tab, label: "Optimization", icon: Lightbulb }]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium transition-colors ${tab === t.key ? "bg-[#5B21B6] text-white" : "text-[#9B93B8] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E]"}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "feed" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard title="Unread" value={String(unreadCount)} icon={<Bell size={20} />} />
            <StatCard title="Critical" value={String(criticalCount)} icon={<Shield size={20} />} />
            <StatCard title="Total" value={String(alerts.length)} icon={<Filter size={20} />} />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
              <option value="">All Severities</option>
              {["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-medium text-[#5B21B6] bg-[#EDE9FE] dark:bg-[#2D1F5E] hover:bg-[#5B21B6] hover:text-white transition-colors ml-auto">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          {loading ? <LoadingSpinner /> : alerts.length === 0 ? <EmptyState title="No alerts" icon={<Bell size={32} />} /> : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <Card key={alert.id} className={!alert.isRead ? "border-l-4 border-l-[#5B21B6]" : ""}>
                  <CardBody className="flex items-start gap-3 py-3">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${severityDot[alert.severity] || "bg-gray-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className={`text-sm font-medium ${!alert.isRead ? "text-[#1E1B2E] dark:text-[#EDE9FE]" : "text-[#4C4566] dark:text-[#B8AEDD]"}`}>{alert.title}</h3>
                        <Badge className={severityColor(alert.severity)}>{alert.severity}</Badge>
                        <Badge variant="purple">{alert.module}</Badge>
                      </div>
                      <p className="text-xs text-[#9B93B8] mb-1">{alert.message}</p>
                      <span className="text-[10px] text-[#9B93B8]">{formatRelativeTime(alert.createdAt)}</span>
                    </div>
                    {!alert.isRead && (
                      <button onClick={() => markRead(alert.id)} className="text-[#9B93B8] hover:text-[#5B21B6] flex-shrink-0" title="Mark as read">
                        <Check size={16} />
                      </button>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "rules" && (
        <>
          <div className="flex justify-end mb-4">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium text-white bg-[#5B21B6] hover:bg-[#7C3AED] transition-colors">
              <Plus size={16} /> New Rule
            </button>
          </div>
          {loading ? <LoadingSpinner /> : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <Card key={rule.id}>
                  <CardBody className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${rule.isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{rule.name}</h3>
                      <p className="text-xs text-[#9B93B8]">{rule.module} · {rule.metric} {rule.condition} {rule.threshold} · Cooldown: {rule.cooldownMin}min</p>
                    </div>
                    <Badge className={severityColor(rule.severity)}>{rule.severity}</Badge>
                    <Badge variant={rule.isActive ? "success" : "default"}>{rule.isActive ? "Active" : "Disabled"}</Badge>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "suggestions" && (
        <>
          {loading ? <LoadingSpinner /> : suggestions.length === 0 ? <EmptyState title="No suggestions yet" icon={<Lightbulb size={32} />} /> : (
            <div className="space-y-4">
              {suggestions.map((sug) => (
                <Card key={sug.id}>
                  <CardBody>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Lightbulb size={16} className="text-[#D97706]" />
                        <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{sug.title}</h3>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={sug.impact === "high" ? "danger" : sug.impact === "medium" ? "warning" : "info"}>Impact: {sug.impact}</Badge>
                        <Badge variant="purple">Effort: {sug.effort}</Badge>
                        <Badge variant={sug.status === "in_progress" ? "success" : "default"}>{sug.status.replace("_", " ")}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-[#4C4566] dark:text-[#B8AEDD] mb-2">{sug.description}</p>
                    <span className="text-[10px] text-[#9B93B8]">Module: {sug.module}</span>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </PageWrapper>
  );
}
