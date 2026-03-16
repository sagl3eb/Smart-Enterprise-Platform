import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, Toast } from "../../components/ui/Modal";
import { Bell, Plus, Check, CheckCheck, Shield, Lightbulb, Filter, Play } from "lucide-react";
import { formatRelativeTime, severityColor } from "../../utils/formatters";
import api from "../../api/client";
import useAlertStore from "../../store/alertStore";
import type { Alert, AlertRule, OptimizationSuggestion } from "../../types";

type Tab = "feed" | "rules" | "suggestions";
const emptyRuleForm = { name: "", module: "hr", metric: "", condition: "gt", threshold: "", severity: "medium", cooldownMin: "60" };

export default function AlertCenter() {
  const [tab, setTab] = useState<Tab>("feed");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState("");
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const { setUnreadCount } = useAlertStore();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "feed") {
        const params = new URLSearchParams({ limit: "30" }); if (severityFilter) params.set("severity", severityFilter);
        const res = await api.get(`/alerts?${params}`); setAlerts(res.data.data || []);
      } else if (tab === "rules") {
        const res = await api.get("/alerts/rules"); setRules(res.data.data || []);
      } else {
        const res = await api.get("/alerts/suggestions"); setSuggestions(res.data.data || []);
      }
    } catch { /* keep empty */ }
    finally { setLoading(false); }
  }, [tab, severityFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const markRead = async (id: string) => {
    try { await api.put(`/alerts/${id}/read`); setAlerts((p) => p.map((a) => a.id === id ? { ...a, isRead: true } : a)); setUnreadCount(alerts.filter((a) => !a.isRead && a.id !== id).length); }
    catch { /* silent */ }
  };

  const markAllRead = async () => {
    try { await api.put("/alerts/read-all", {}); setAlerts((p) => p.map((a) => ({ ...a, isRead: true }))); setUnreadCount(0); }
    catch { /* silent */ }
  };

  const resolveAlert = async (id: string) => {
    try { await api.put(`/alerts/${id}/resolve`); setToast({ message: "Alert resolved", type: "success" }); fetchData(); }
    catch { setToast({ message: "Failed to resolve", type: "error" }); }
  };

  const evaluateRules = async () => {
    setSaving(true);
    try { const res = await api.post("/alerts/evaluate"); setToast({ message: `Evaluated ${res.data.data.evaluated} rules, triggered ${res.data.data.triggered}`, type: "success" }); fetchData(); }
    catch { setToast({ message: "Failed to evaluate", type: "error" }); }
    finally { setSaving(false); }
  };

  const handleCreateRule = async () => {
    if (!ruleForm.name || !ruleForm.metric || !ruleForm.threshold) { setToast({ message: "Name, metric, threshold required", type: "error" }); return; }
    setSaving(true);
    try {
      await api.post("/alerts/rules", { ...ruleForm, threshold: Number(ruleForm.threshold), cooldownMin: Number(ruleForm.cooldownMin) });
      setToast({ message: "Rule created", type: "success" }); setShowRuleForm(false); fetchData();
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed", type: "error" });
    } finally { setSaving(false); }
  };

  const toggleRule = async (id: string, isActive: boolean) => {
    try { await api.put(`/alerts/rules/${id}`, { isActive: !isActive }); fetchData(); }
    catch { setToast({ message: "Failed to toggle", type: "error" }); }
  };

  const updateSuggestionStatus = async (id: string, status: string) => {
    try { await api.put(`/alerts/suggestions/${id}/status`, { status }); setToast({ message: "Updated", type: "success" }); fetchData(); }
    catch { setToast({ message: "Failed", type: "error" }); }
  };

  const unreadCount = alerts.filter((a) => !a.isRead).length;
  const criticalCount = alerts.filter((a) => a.severity === "critical" && !a.isResolved).length;
  const severityDot: Record<string, string> = { critical: "bg-red-500", high: "bg-orange-500", medium: "bg-yellow-500", low: "bg-blue-500", info: "bg-gray-400" };

  return (
    <PageWrapper title="Alert Center" subtitle="Alerts & Optimization">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

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
            {unreadCount > 0 && <Button variant="secondary" onClick={markAllRead} className="ml-auto"><CheckCheck size={14} /> Mark all read</Button>}
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
                    <div className="flex gap-1 flex-shrink-0">
                      {!alert.isRead && <button onClick={() => markRead(alert.id)} className="p-1.5 rounded-[6px] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] text-[#9B93B8] hover:text-[#5B21B6]" title="Mark read"><Check size={14} /></button>}
                      {!alert.isResolved && <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => resolveAlert(alert.id)}>Resolve</Button>}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "rules" && (
        <>
          <div className="flex justify-between mb-4">
            <Button variant="secondary" onClick={evaluateRules} loading={saving}><Play size={14} /> Run Evaluation</Button>
            <Button onClick={() => { setRuleForm(emptyRuleForm); setShowRuleForm(true); }}><Plus size={16} /> New Rule</Button>
          </div>
          {loading ? <LoadingSpinner /> : rules.length === 0 ? <EmptyState title="No rules" icon={<Shield size={32} />} /> : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <Card key={rule.id}>
                  <CardBody className="flex items-center gap-4">
                    <button onClick={() => toggleRule(rule.id, rule.isActive)} className={`w-3 h-3 rounded-full cursor-pointer ${rule.isActive ? "bg-emerald-500" : "bg-gray-400"}`} title={rule.isActive ? "Click to disable" : "Click to enable"} />
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

          <Modal open={showRuleForm} onClose={() => setShowRuleForm(false)} title="Create Alert Rule" size="md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormInput label="Rule Name" value={ruleForm.name} onChange={(v) => setRuleForm((p) => ({ ...p, name: v }))} required />
              <FormSelect label="Module" value={ruleForm.module} onChange={(v) => setRuleForm((p) => ({ ...p, module: v }))} options={[
                { value: "hr", label: "HR" }, { value: "finance", label: "Finance" }, { value: "ict", label: "ICT" },
                { value: "construction", label: "Construction" }, { value: "workforce", label: "Workforce" },
              ]} />
              <FormInput label="Metric" value={ruleForm.metric} onChange={(v) => setRuleForm((p) => ({ ...p, metric: v }))} required placeholder="e.g. open_tickets, budget_utilization" />
              <FormSelect label="Condition" value={ruleForm.condition} onChange={(v) => setRuleForm((p) => ({ ...p, condition: v }))} options={[
                { value: "gt", label: "Greater than" }, { value: "lt", label: "Less than" }, { value: "gte", label: ">= " },
                { value: "lte", label: "<= " }, { value: "eq", label: "Equals" },
              ]} />
              <FormInput label="Threshold" value={ruleForm.threshold} onChange={(v) => setRuleForm((p) => ({ ...p, threshold: v }))} type="number" required />
              <FormSelect label="Severity" value={ruleForm.severity} onChange={(v) => setRuleForm((p) => ({ ...p, severity: v }))} options={[
                { value: "critical", label: "Critical" }, { value: "high", label: "High" },
                { value: "medium", label: "Medium" }, { value: "low", label: "Low" },
              ]} />
              <FormInput label="Cooldown (min)" value={ruleForm.cooldownMin} onChange={(v) => setRuleForm((p) => ({ ...p, cooldownMin: v }))} type="number" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setShowRuleForm(false)}>Cancel</Button>
              <Button onClick={handleCreateRule} loading={saving}>Create Rule</Button>
            </div>
          </Modal>
        </>
      )}

      {tab === "suggestions" && (
        <>
          {loading ? <LoadingSpinner /> : suggestions.length === 0 ? <EmptyState title="No suggestions" icon={<Lightbulb size={32} />} /> : (
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
                      </div>
                    </div>
                    <p className="text-xs text-[#4C4566] dark:text-[#B8AEDD] mb-3">{sug.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#9B93B8]">Module: {sug.module}</span>
                      <div className="flex gap-2">
                        {sug.status === "pending" && <>
                          <Button variant="secondary" className="text-xs py-1 px-3" onClick={() => updateSuggestionStatus(sug.id, "in_progress")}>Start</Button>
                          <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => updateSuggestionStatus(sug.id, "dismissed")}>Dismiss</Button>
                        </>}
                        {sug.status === "in_progress" && <Button variant="secondary" className="text-xs py-1 px-3" onClick={() => updateSuggestionStatus(sug.id, "completed")}>Complete</Button>}
                        <Badge variant={sug.status === "completed" ? "success" : sug.status === "in_progress" ? "warning" : "default"}>{sug.status.replace("_", " ")}</Badge>
                      </div>
                    </div>
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
