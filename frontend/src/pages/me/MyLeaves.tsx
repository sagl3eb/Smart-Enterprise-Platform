import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, ConfirmDialog, Toast } from "../../components/ui/Modal";
import { Calendar, Plus, X } from "lucide-react";
import { formatDate, statusColor } from "../../utils/formatters";
import api from "../../api/client";

interface LeaveType { id: string; name: string; isPaid: boolean; defaultDays: number; }
interface Leave {
  id: string; startDate: string; endDate: string; totalDays: string; reason: string | null;
  status: string; createdAt: string; approvedAt: string | null;
  leaveType: { id: string; name: string; isPaid: boolean };
}

export default function MyLeaves() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, t] = await Promise.all([api.get("/me/leaves"), api.get("/me/leave-types")]);
      setLeaves(l.data.data || []);
      setTypes(t.data.data || []);
    } catch { setLeaves([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ leaveTypeId: types[0]?.id || "", startDate: "", endDate: "", reason: "" });
    setShowForm(true);
  };

  const submit = async () => {
    if (!form.leaveTypeId || !form.startDate || !form.endDate) {
      setToast({ message: "Type, start and end are required", type: "error" }); return;
    }
    setSaving(true);
    try {
      await api.post("/me/leaves", form);
      setToast({ message: "Leave request submitted", type: "success" });
      setShowForm(false); load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed";
      setToast({ message: msg, type: "error" });
    } finally { setSaving(false); }
  };

  const cancel = async () => {
    if (!cancelId) return;
    setSaving(true);
    try {
      await api.delete(`/me/leaves/${cancelId}`);
      setToast({ message: "Request cancelled", type: "success" });
      setCancelId(null); load();
    } catch { setToast({ message: "Cancel failed", type: "error" }); }
    finally { setSaving(false); }
  };

  const pending = leaves.filter((l) => l.status === "pending").length;
  const approved = leaves.filter((l) => l.status === "approved").length;
  const taken = leaves.reduce((s, l) => s + (l.status === "approved" ? Number(l.totalDays) : 0), 0);

  return (
    <PageWrapper title="My Leaves" subtitle="Your leave history and requests">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatTile label="Pending" value={pending} tone="#B45309" />
        <StatTile label="Approved" value={approved} tone="#047857" />
        <StatTile label="Days taken (YTD)" value={taken} tone="#5B21B6" />
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[#1E1B2E] dark:text-[#EDE9FE] font-semibold">
              <Calendar size={18} /> My leave requests
            </div>
            <Button onClick={openCreate}><Plus size={14} className="inline -mt-0.5 mr-1" /> Apply for leave</Button>
          </div>

          {loading ? <div className="py-12"><LoadingSpinner /></div> :
            leaves.length === 0 ? <EmptyState title="No leave requests yet" description="Apply for leave to see it here." /> :
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#6B5F8F] dark:text-[#C8BFE6] border-b border-[#E8E4F3] dark:border-[#2E2850]">
                    <th className="py-3 pr-4 font-medium">Type</th>
                    <th className="py-3 pr-4 font-medium">From</th>
                    <th className="py-3 pr-4 font-medium">To</th>
                    <th className="py-3 pr-4 font-medium">Days</th>
                    <th className="py-3 pr-4 font-medium">Reason</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 pr-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id} className="border-b border-[#F1EEFF] dark:border-[#221E42]">
                      <td className="py-3 pr-4 text-[#1E1B2E] dark:text-[#EDE9FE]">{l.leaveType.name}</td>
                      <td className="py-3 pr-4">{formatDate(l.startDate)}</td>
                      <td className="py-3 pr-4">{formatDate(l.endDate)}</td>
                      <td className="py-3 pr-4">{Number(l.totalDays)}</td>
                      <td className="py-3 pr-4 text-[#6B5F8F] dark:text-[#C8BFE6] max-w-[240px] truncate">{l.reason || "—"}</td>
                      <td className="py-3 pr-4"><Badge variant={statusColor(l.status) as "default" | "success" | "warning" | "danger" | "info"}>{l.status}</Badge></td>
                      <td className="py-3 pr-4 text-right">
                        {l.status === "pending" && (
                          <button onClick={() => setCancelId(l.id)}
                            className="text-xs text-[#991B1B] hover:underline flex items-center gap-1">
                            <X size={12} /> Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        </CardBody>
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Apply for leave">
        <div className="space-y-3">
          <FormSelect label="Leave type" value={form.leaveTypeId}
            onChange={(v) => setForm((p) => ({ ...p, leaveTypeId: v }))}
            options={types.map((t) => ({ value: t.id, label: `${t.name}${t.isPaid ? "" : " (unpaid)"}` }))}
            required />
          <div className="grid grid-cols-2 gap-3">
            <FormInput type="date" label="Start date" value={form.startDate} onChange={(v) => setForm((p) => ({ ...p, startDate: v }))} required />
            <FormInput type="date" label="End date" value={form.endDate} onChange={(v) => setForm((p) => ({ ...p, endDate: v }))} required />
          </div>
          <FormTextarea label="Reason (optional)" value={form.reason} onChange={(v) => setForm((p) => ({ ...p, reason: v }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={submit} loading={saving}>Submit request</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!cancelId} onClose={() => setCancelId(null)} onConfirm={cancel}
        title="Cancel leave request?" message="This will permanently remove your pending request."
        confirmLabel="Cancel request" loading={saving} />

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
