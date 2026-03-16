import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, Toast } from "../../components/ui/Modal";
import { Ticket, Plus, Search, AlertCircle, Clock, CheckCircle, Loader } from "lucide-react";
import { formatRelativeTime, severityColor, statusColor } from "../../utils/formatters";
import api from "../../api/client";
import type { ItTicket } from "../../types";

const emptyForm = { ticketNumber: "", title: "", description: "", category: "Software", priority: "medium", reportedBy: "", assignedTo: "" };

export default function Tickets() {
  const [tickets, setTickets] = useState<ItTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<ItTicket | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/ict/tickets?${params}`);
      setTickets(res.data.data || []);
    } catch { setTickets([]); }
    finally { setLoading(false); }
  }, [statusFilter, priorityFilter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const openCreate = () => {
    setForm({ ...emptyForm, ticketNumber: `TKT-${Date.now().toString().slice(-5)}` });
    setEditingId(null); setShowForm(true);
  };

  const openDetail = (ticket: ItTicket) => { setSelectedTicket(ticket); setShowDetail(true); };

  const handleSave = async () => {
    if (!form.title || !form.description || !form.category || !form.reportedBy) {
      setToast({ message: "Please fill in title, description, category, and reported by", type: "error" }); return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/ict/tickets/${editingId}`, form);
        setToast({ message: "Ticket updated", type: "success" });
      } else {
        await api.post("/ict/tickets", { ...form, ticketNumber: form.ticketNumber || `TKT-${Date.now().toString().slice(-5)}` });
        setToast({ message: "Ticket created", type: "success" });
      }
      setShowForm(false); fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save";
      setToast({ message: msg, type: "error" });
    } finally { setSaving(false); }
  };

  const updateStatus = async (id: string, status: string, resolution?: string) => {
    try {
      await api.put(`/ict/tickets/${id}`, { status, resolution });
      setToast({ message: `Ticket ${status.replace("_", " ")}`, type: "success" });
      setShowDetail(false); fetchData();
    } catch { setToast({ message: "Failed to update status", type: "error" }); }
  };

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;
  const criticalCount = tickets.filter((t) => t.priority === "critical" && t.status !== "resolved" && t.status !== "closed").length;

  const priorityIcon = (p: string) => {
    switch (p) {
      case "critical": return <AlertCircle size={14} className="text-red-500" />;
      case "high": return <AlertCircle size={14} className="text-orange-500" />;
      case "medium": return <Clock size={14} className="text-yellow-500" />;
      default: return <Clock size={14} className="text-blue-500" />;
    }
  };

  return (
    <PageWrapper title="IT Tickets" subtitle="ICT Management — Support tickets">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Open" value={String(openCount)} icon={<Ticket size={20} />} />
        <StatCard title="In Progress" value={String(inProgressCount)} icon={<Loader size={20} />} />
        <StatCard title="Resolved" value={String(resolvedCount)} icon={<CheckCircle size={20} />} />
        <StatCard title="Critical" value={String(criticalCount)} icon={<AlertCircle size={20} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchData()} placeholder="Search tickets..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Statuses</option>
          {["open", "in_progress", "resolved", "closed"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Priorities</option>
          {["critical", "high", "medium", "low"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <Button onClick={openCreate} className="ml-auto"><Plus size={16} /> New Ticket</Button>
      </div>

      {loading ? <LoadingSpinner /> : tickets.length === 0 ? <EmptyState title="No tickets found" icon={<Ticket size={32} />} /> : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id} onClick={() => openDetail(ticket)} className="cursor-pointer">
              <CardBody className="flex items-start gap-3 py-3">
                <div className="flex-shrink-0 mt-0.5">{priorityIcon(ticket.priority)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-[#5B21B6]">{ticket.ticketNumber}</span>
                    <Badge className={severityColor(ticket.priority)}>{ticket.priority}</Badge>
                    <Badge className={statusColor(ticket.status)}>{ticket.status.replace("_", " ")}</Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE] mb-1">{ticket.title}</h3>
                  <p className="text-xs text-[#9B93B8] line-clamp-1 mb-1">{ticket.description}</p>
                  <div className="flex items-center gap-4 text-[10px] text-[#9B93B8]">
                    <span>{ticket.category}</span>
                    <span>By: {ticket.reportedBy}</span>
                    {ticket.assignedTo && <span>Assigned: {ticket.assignedTo}</span>}
                    <span>{formatRelativeTime(ticket.createdAt)}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New IT Ticket" size="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput label="Title" value={form.title} onChange={(v) => setField("title", v)} required />
          <FormSelect label="Category" value={form.category} onChange={(v) => setField("category", v)} required options={[
            { value: "Software", label: "Software" }, { value: "Hardware", label: "Hardware" },
            { value: "Network", label: "Network" }, { value: "Infrastructure", label: "Infrastructure" },
            { value: "Security", label: "Security" }, { value: "Other", label: "Other" },
          ]} />
          <FormSelect label="Priority" value={form.priority} onChange={(v) => setField("priority", v)} options={[
            { value: "critical", label: "Critical" }, { value: "high", label: "High" },
            { value: "medium", label: "Medium" }, { value: "low", label: "Low" },
          ]} />
          <FormInput label="Reported By" value={form.reportedBy} onChange={(v) => setField("reportedBy", v)} required />
          <FormInput label="Assigned To" value={form.assignedTo} onChange={(v) => setField("assignedTo", v)} placeholder="Optional" />
        </div>
        <FormTextarea label="Description" value={form.description} onChange={(v) => setField("description", v)} rows={4} />
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Create Ticket</Button>
        </div>
      </Modal>

      {/* Detail/Action Modal */}
      <Modal open={showDetail} onClose={() => { setShowDetail(false); setSelectedTicket(null); }} title="Ticket Details" size="lg">
        {selectedTicket && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-mono text-[#5B21B6]">{selectedTicket.ticketNumber}</span>
              <Badge className={severityColor(selectedTicket.priority)}>{selectedTicket.priority}</Badge>
              <Badge className={statusColor(selectedTicket.status)}>{selectedTicket.status.replace("_", " ")}</Badge>
            </div>
            <h3 className="text-lg font-semibold text-[#1E1B2E] dark:text-[#EDE9FE] mb-2">{selectedTicket.title}</h3>
            <p className="text-sm text-[#4C4566] dark:text-[#B8AEDD] mb-4">{selectedTicket.description}</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[["Category", selectedTicket.category], ["Reported By", selectedTicket.reportedBy],
                ["Assigned To", selectedTicket.assignedTo || "Unassigned"], ["Created", formatRelativeTime(selectedTicket.createdAt)]
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] font-medium text-[#9B93B8] uppercase">{label}</p>
                  <p className="text-sm text-[#1E1B2E] dark:text-[#EDE9FE]">{value}</p>
                </div>
              ))}
            </div>
            {selectedTicket.resolution && (
              <div className="mb-4 p-3 rounded-[10px] bg-emerald-50 dark:bg-emerald-900/20">
                <p className="text-[10px] font-medium text-emerald-600 uppercase mb-1">Resolution</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400">{selectedTicket.resolution}</p>
              </div>
            )}
            {selectedTicket.status !== "resolved" && selectedTicket.status !== "closed" && (
              <div className="flex gap-2 pt-4 border-t border-[#E8E4F3] dark:border-[#2E2850]">
                {selectedTicket.status === "open" && (
                  <Button variant="secondary" onClick={() => updateStatus(selectedTicket.id, "in_progress")}>Start Working</Button>
                )}
                <Button onClick={() => {
                  const resolution = prompt("Resolution notes (optional):");
                  updateStatus(selectedTicket.id, "resolved", resolution || undefined);
                }}>Resolve</Button>
                <Button variant="ghost" onClick={() => updateStatus(selectedTicket.id, "closed")}>Close</Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageWrapper>
  );
}
