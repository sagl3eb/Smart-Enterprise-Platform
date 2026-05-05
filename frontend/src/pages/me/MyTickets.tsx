import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, Toast } from "../../components/ui/Modal";
import { Ticket, Plus, Clock, CheckCircle2, UserCircle, AlertCircle } from "lucide-react";
import { formatDate, statusColor } from "../../utils/formatters";
import api from "../../api/client";

interface TimelineEvent { at: string; kind: string; text: string; }
interface MyTicket {
  id: string; ticketNumber: string; title: string; description: string;
  category: string; priority: string; status: string;
  assignedTo: string | null; resolution: string | null;
  createdAt: string; updatedAt: string; resolvedAt: string | null;
  timeline: TimelineEvent[];
}

const categories = ["Hardware", "Software", "Network", "Access", "Other"];
const priorities = ["low", "medium", "high", "critical"];

export default function MyTickets() {
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [selected, setSelected] = useState<MyTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "Hardware", priority: "medium" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/me/tickets");
      setTickets(res.data.data || []);
    } catch { setTickets([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      setToast({ message: "Title and description are required", type: "error" }); return;
    }
    setSaving(true);
    try {
      await api.post("/me/tickets", form);
      setToast({ message: "Ticket submitted", type: "success" });
      setShowForm(false);
      setForm({ title: "", description: "", category: "Hardware", priority: "medium" });
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed";
      setToast({ message: msg, type: "error" });
    } finally { setSaving(false); }
  };

  const open = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const resolved = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;

  return (
    <PageWrapper title="My Tickets" subtitle="IT support requests you've filed">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatTile label="Open" value={open} tone="#B45309" />
        <StatTile label="Resolved" value={resolved} tone="#047857" />
        <StatTile label="Total" value={tickets.length} tone="#5B21B6" />
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[#1E1B2E] dark:text-[#EDE9FE] font-semibold">
              <Ticket size={18} /> My tickets
            </div>
            <Button onClick={() => setShowForm(true)}><Plus size={14} className="inline -mt-0.5 mr-1" /> New ticket</Button>
          </div>

          {loading ? <div className="py-12"><LoadingSpinner /></div> :
            tickets.length === 0 ? <EmptyState title="No tickets yet" description="File a ticket when you need IT help." /> :
            <div className="space-y-2">
              {tickets.map((t) => (
                <button key={t.id} onClick={() => setSelected(t)}
                  className="w-full text-left p-4 rounded-xl border transition hover:shadow-sm
                    bg-white dark:bg-[#1A1635] border-[#E8E4F3] dark:border-[#2E2850]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-mono text-[#6B5F8F] dark:text-[#B8AEDD]">{t.ticketNumber}</span>
                        <Badge variant={statusColor(t.status) as "default" | "success" | "warning" | "danger" | "info"}>{t.status}</Badge>
                        <Badge variant={t.priority === "critical" || t.priority === "high" ? "danger" : "default"}>{t.priority}</Badge>
                      </div>
                      <div className="font-medium text-[#1E1B2E] dark:text-[#EDE9FE] truncate">{t.title}</div>
                      <div className="text-xs text-[#6B5F8F] dark:text-[#C8BFE6] mt-1 truncate">{t.description}</div>
                    </div>
                    <div className="text-right text-xs text-[#6B5F8F] dark:text-[#B8AEDD]">
                      <div>{formatDate(t.createdAt)}</div>
                      {t.assignedTo && <div className="mt-1">→ {t.assignedTo}</div>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          }
        </CardBody>
      </Card>

      {/* Create */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New IT ticket">
        <div className="space-y-3">
          <FormInput label="Title" value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} required />
          <FormTextarea label="Description" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} rows={4} required />
          <div className="grid grid-cols-2 gap-3">
            <FormSelect label="Category" value={form.category} onChange={(v) => setForm((p) => ({ ...p, category: v }))}
              options={categories.map((c) => ({ value: c, label: c }))} required />
            <FormSelect label="Priority" value={form.priority} onChange={(v) => setForm((p) => ({ ...p, priority: v }))}
              options={priorities.map((p) => ({ value: p, label: p }))} required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={submit} loading={saving}>Submit ticket</Button>
          </div>
        </div>
      </Modal>

      {/* Detail + timeline */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.ticketNumber || ""} size="lg">
        {selected && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={statusColor(selected.status) as "default" | "success" | "warning" | "danger" | "info"}>{selected.status}</Badge>
                <Badge variant={selected.priority === "critical" || selected.priority === "high" ? "danger" : "default"}>{selected.priority}</Badge>
                <Badge variant="info">{selected.category}</Badge>
              </div>
              <h3 className="text-lg font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{selected.title}</h3>
              <p className="text-sm text-[#6B5F8F] dark:text-[#C8BFE6] mt-2 whitespace-pre-wrap">{selected.description}</p>
            </div>

            {selected.assignedTo && (
              <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-[#F8F7FF] dark:bg-[#1A1635]">
                <UserCircle size={16} className="text-[#5B21B6] dark:text-[#A89FC8]" />
                <span className="text-[#6B5F8F] dark:text-[#C8BFE6]">Assigned to</span>
                <span className="font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{selected.assignedTo}</span>
              </div>
            )}

            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#6B5F8F] dark:text-[#C8BFE6] mb-3">Timeline</div>
              <ol className="relative border-l-2 border-[#E8E4F3] dark:border-[#2E2850] pl-5 space-y-3">
                {selected.timeline.map((ev, i) => (
                  <li key={i} className="relative">
                    <div className="absolute -left-[27px] top-0.5 w-3 h-3 rounded-full border-2"
                      style={{ background: ev.kind === "resolved" ? "#047857" : "#5B21B6", borderColor: "#fff" }} />
                    <div className="flex items-center gap-2 text-xs text-[#6B5F8F] dark:text-[#B8AEDD]">
                      {ev.kind === "resolved" ? <CheckCircle2 size={12} /> : ev.kind === "created" ? <AlertCircle size={12} /> : <Clock size={12} />}
                      {formatDate(ev.at)}
                    </div>
                    <div className="text-sm text-[#1E1B2E] dark:text-[#EDE9FE] mt-0.5">{ev.text}</div>
                  </li>
                ))}
              </ol>
            </div>

            {selected.resolution && (
              <div className="p-3 rounded-lg border-l-4 border-[#047857] bg-[#F0FDF4] dark:bg-[#0F2819]">
                <div className="text-[11px] uppercase tracking-wider text-[#047857] mb-1">Resolution</div>
                <p className="text-sm text-[#1E1B2E] dark:text-[#EDE9FE] whitespace-pre-wrap">{selected.resolution}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </PageWrapper>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardBody>
        <div className="text-[11px] uppercase tracking-wider text-[#6B5F8F] dark:text-[#C8BFE6]">{label}</div>
        <div className="text-3xl font-serif font-semibold mt-2" style={{ color: tone }}>{value}</div>
      </CardBody>
    </Card>
  );
}
