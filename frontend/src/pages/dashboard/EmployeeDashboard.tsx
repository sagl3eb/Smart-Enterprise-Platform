import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, Toast } from "../../components/ui/Modal";
import { CalendarPlus, TicketPlus, ClipboardList, Monitor, FileText, Users, CheckCircle2, TrendingUp, PieChart, HardHat, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate, formatRelativeTime } from "../../utils/formatters";
import api from "../../api/client";
import useAuthStore from "../../store/authStore";
import type { LeaveType, LeaveRequest, ItTicket, Project, Material } from "../../types";
import { BarChartWidget, DonutChartWidget } from "../../components/charts/Charts";

type ModalType = "leave" | "ticket" | "material" | null;

const emptyLeave = { leaveTypeId: "", startDate: "", endDate: "", reason: "" };
const emptyTicket = { title: "", description: "", category: "hardware", priority: "medium" };
const emptyMaterial = { projectId: "", materialId: "", quantity: "" };

const statusVariant: Record<string, "success" | "warning" | "danger" | "default"> = {
  approved: "success", pending: "warning", rejected: "danger",
  open: "warning", in_progress: "warning", resolved: "success", closed: "default",
};

export default function EmployeeDashboard() {
  const user = useAuthStore((s) => s.user);

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [tickets, setTickets] = useState<ItTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

  const [leaveForm, setLeaveForm] = useState(emptyLeave);
  const [ticketForm, setTicketForm] = useState(emptyTicket);
  const [materialForm, setMaterialForm] = useState(emptyMaterial);

  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [materialOptions, setMaterialOptions] = useState<Material[]>([]);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const fetchMyData = async () => {
    setLoading(true);
    try {
      const [leaveRes, ticketRes] = await Promise.allSettled([
        api.get("/me/leaves"),
        api.get("/me/tickets"),
      ]);
      if (leaveRes.status === "fulfilled") setLeaves(leaveRes.value.data.data || []);
      if (ticketRes.status === "fulfilled") setTickets(ticketRes.value.data.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchMyData(); }, []);

  // Discover the caller's employee ID and only the projects they're on the team of.
  useEffect(() => {
    (async () => {
      try {
        const profileRes = await api.get("/me/profile");
        const empId = profileRes.data?.data?.employee?.id || null;
        if (!empId) return;
        setEmployeeId(empId);

        const projRes = await api.get("/construction/projects?limit=100");
        const all: Project[] = projRes.data.data || [];
        const mine = all.filter((p) =>
          (p.teamMemberIds || []).includes(empId) &&
          p.status !== "cancelled" &&
          p.status !== "completed"
        );
        setMyProjects(mine);
      } catch { /* silent — module access may be restricted */ }
    })();
  }, []);

  const loadLeaveTypes = async () => {
    if (leaveTypes.length) return;
    try {
      const res = await api.get("/me/leave-types");
      setLeaveTypes(res.data.data || []);
    } catch { /* silent */ }
  };

  const openLeave = async () => { setLeaveForm(emptyLeave); setModal("leave"); await loadLeaveTypes(); };
  const openTicket = () => { setTicketForm(emptyTicket); setModal("ticket"); };

  const openMaterial = async (projectId: string) => {
    setMaterialForm({ projectId, materialId: "", quantity: "" });
    setModal("material");
    if (materialOptions.length === 0) {
      try {
        const res = await api.get("/construction/materials?limit=200");
        setMaterialOptions(res.data.data || []);
      } catch { /* silent */ }
    }
  };

  const submitMaterial = async () => {
    if (!materialForm.projectId || !materialForm.materialId || !materialForm.quantity || Number(materialForm.quantity) <= 0) {
      setToast({ message: "Pick a material and a positive quantity", type: "error" }); return;
    }
    setSaving(true);
    try {
      await api.post("/construction/material-requests", {
        projectId: materialForm.projectId,
        materialId: materialForm.materialId,
        quantity: Number(materialForm.quantity),
        requestedBy: `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Employee",
      });
      setToast({ message: "Material request submitted", type: "success" });
      setModal(null);
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to request material", type: "error" });
    } finally { setSaving(false); }
  };

  const submitLeave = async () => {
    if (!leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.endDate) {
      setToast({ message: "Please fill all required fields", type: "error" }); return;
    }
    setSaving(true);
    try {
      await api.post("/me/leaves", leaveForm);
      setToast({ message: "Leave request submitted", type: "success" });
      setModal(null);
      fetchMyData();
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to submit", type: "error" });
    } finally { setSaving(false); }
  };

  const submitTicket = async () => {
    if (!ticketForm.title || !ticketForm.description) {
      setToast({ message: "Please fill all required fields", type: "error" }); return;
    }
    setSaving(true);
    try {
      await api.post("/me/tickets", ticketForm);
      setToast({ message: "Ticket submitted", type: "success" });
      setModal(null);
      fetchMyData();
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to submit ticket", type: "error" });
    } finally { setSaving(false); }
  };

  const pendingLeaves = leaves.filter((l) => l.status === "pending").length;
  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;

  // 6-month activity: leave days requested + tickets submitted per month
  const activityData = (() => {
    const months: { name: string; key: string; leaveDays: number; tickets: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        name: d.toLocaleString("en-US", { month: "short" }),
        key,
        leaveDays: 0,
        tickets: 0,
      });
    }
    const bucket = Object.fromEntries(months.map((m) => [m.key, m]));
    for (const l of leaves) {
      const d = new Date(l.startDate);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (bucket[k]) bucket[k].leaveDays += Number(l.totalDays || 0);
    }
    for (const t of tickets) {
      const d = new Date(t.createdAt);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (bucket[k]) bucket[k].tickets += 1;
    }
    return months.map(({ name, leaveDays, tickets }) => ({ name, "Leave Days": leaveDays, "Tickets": tickets }));
  })();

  // Ticket status breakdown
  const ticketBreakdown = (() => {
    const counts: Record<string, number> = {};
    for (const t of tickets) counts[t.status] = (counts[t.status] || 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace("_", " "), value }));
  })();

  return (
    <PageWrapper title={`Welcome back, ${user?.firstName || "there"}`} subtitle="Your personal workspace">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <button onClick={openLeave} className="group flex items-center gap-3 p-4 rounded-[12px] bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] hover:border-[#5B21B6] hover:shadow-md transition">
          <div className="w-10 h-10 rounded-[10px] bg-[#EDE9FE] dark:bg-[#2D1F5E] flex items-center justify-center text-[#5B21B6] group-hover:scale-105 transition"><CalendarPlus size={18} /></div>
          <div className="text-left"><p className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Apply for Leave</p><p className="text-[11px] text-[#4C4566] dark:text-[#B8AEDD]">Request time off</p></div>
        </button>
        <button onClick={openTicket} className="group flex items-center gap-3 p-4 rounded-[12px] bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] hover:border-[#5B21B6] hover:shadow-md transition">
          <div className="w-10 h-10 rounded-[10px] bg-[#EDE9FE] dark:bg-[#2D1F5E] flex items-center justify-center text-[#5B21B6] group-hover:scale-105 transition"><TicketPlus size={18} /></div>
          <div className="text-left"><p className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">New IT Ticket</p><p className="text-[11px] text-[#4C4566] dark:text-[#B8AEDD]">Report an issue</p></div>
        </button>
        <Link to="/directory" className="group flex items-center gap-3 p-4 rounded-[12px] bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] hover:border-[#5B21B6] hover:shadow-md transition">
          <div className="w-10 h-10 rounded-[10px] bg-[#EDE9FE] dark:bg-[#2D1F5E] flex items-center justify-center text-[#5B21B6] group-hover:scale-105 transition"><Users size={18} /></div>
          <div className="text-left"><p className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Employee Directory</p><p className="text-[11px] text-[#4C4566] dark:text-[#B8AEDD]">Find a colleague</p></div>
        </Link>
        <Link to="/me/assets" className="group flex items-center gap-3 p-4 rounded-[12px] bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] hover:border-[#5B21B6] hover:shadow-md transition">
          <div className="w-10 h-10 rounded-[10px] bg-[#EDE9FE] dark:bg-[#2D1F5E] flex items-center justify-center text-[#5B21B6] group-hover:scale-105 transition"><Monitor size={18} /></div>
          <div className="text-left"><p className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">My Assets</p><p className="text-[11px] text-[#4C4566] dark:text-[#B8AEDD]">View assigned IT</p></div>
        </Link>
      </div>

      {/* Personal stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Pending Leaves" value={String(pendingLeaves)} subtitle="awaiting approval" icon={<ClipboardList size={20} />} />
        <StatCard title="Open Tickets" value={String(openTickets)} subtitle="in progress" icon={<Monitor size={20} />} />
        <StatCard title="Total Leave Requests" value={String(leaves.length)} subtitle="this period" icon={<FileText size={20} />} />
        <StatCard title="Resolved Tickets" value={String(tickets.filter((t) => t.status === "resolved" || t.status === "closed").length)} subtitle="completed" icon={<CheckCircle2 size={20} />} />
      </div>

      {/* My Projects — only visible to employees assigned to a project team */}
      {employeeId && myProjects.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">
              <HardHat size={16} className="inline mr-2" />My Projects · {myProjects.length} active
            </h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myProjects.map((p) => (
                <div key={p.id} className="p-3 rounded-[10px] border border-[#E8E4F3] dark:border-[#2E2850] bg-white dark:bg-[#16122E]">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-mono text-[#5B21B6]">{p.code}</p>
                      <p className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE] truncate">{p.name}</p>
                    </div>
                    <Badge variant={p.status === "active" || p.status === "in_progress" ? "success" : "warning"}>{p.status.replace("_", " ")}</Badge>
                  </div>
                  <div className="h-1.5 bg-[#EDE9FE] dark:bg-[#2D1F5E] rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-[#5B21B6] rounded-full" style={{ width: `${p.progress}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#9B93B8] mb-3">
                    <span>{p.progress}% complete</span>
                    {p.location && <span>{p.location}</span>}
                  </div>
                  <Button variant="ghost" className="w-full text-xs py-1.5" onClick={() => openMaterial(p.id)}>
                    <Package size={12} /> Request Material
                  </Button>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Insights: 6-month activity + ticket breakdown */}
      {!loading && (leaves.length > 0 || tickets.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2 self-start">
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]"><TrendingUp size={16} className="inline mr-2" />My Activity · Last 6 Months</h3></CardHeader>
            <CardBody>
              <BarChartWidget
                data={activityData}
                bars={[
                  { key: "Leave Days", color: "#5B21B6" },
                  { key: "Tickets", color: "#B45309" },
                ]}
                height={260}
              />
            </CardBody>
          </Card>

          <Card className="self-start">
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]"><PieChart size={16} className="inline mr-2" />My Tickets Status</h3></CardHeader>
            <CardBody>
              {ticketBreakdown.length === 0 ? (
                <EmptyState title="No tickets yet" icon={<Monitor size={24} />} />
              ) : (
                <DonutChartWidget data={ticketBreakdown} height={260} />
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]"><ClipboardList size={16} className="inline mr-2" />Recent Leave Requests</h3></CardHeader>
            <CardBody>
              {leaves.length === 0 ? <EmptyState title="No leave requests yet" icon={<ClipboardList size={24} />} /> : (
                <div className="space-y-3">
                  {leaves.slice(0, 5).map((l) => (
                    <div key={l.id} className="flex items-center justify-between pb-3 border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{l.employee?.firstName} {l.employee?.lastName} · {l.leaveType?.name}</p>
                        <p className="text-[11px] text-[#4C4566] dark:text-[#B8AEDD]">{formatDate(l.startDate)} — {formatDate(l.endDate)} · {l.totalDays} days</p>
                      </div>
                      <Badge variant={statusVariant[l.status] || "default"}>{l.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]"><Monitor size={16} className="inline mr-2" />Recent IT Tickets</h3></CardHeader>
            <CardBody>
              {tickets.length === 0 ? <EmptyState title="No tickets yet" icon={<Monitor size={24} />} /> : (
                <div className="space-y-3">
                  {tickets.slice(0, 5).map((t) => (
                    <div key={t.id} className="flex items-center justify-between pb-3 border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE] truncate">{t.title}</p>
                        <p className="text-[11px] text-[#4C4566] dark:text-[#B8AEDD]">{t.ticketNumber} · {formatRelativeTime(t.createdAt)}</p>
                      </div>
                      <Badge variant={statusVariant[t.status] || "default"}>{t.status.replace("_", " ")}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Leave modal */}
      <Modal open={modal === "leave"} onClose={() => setModal(null)} title="Apply for Leave" size="md">
        <div className="space-y-4">
          <FormSelect label="Leave Type" value={leaveForm.leaveTypeId} onChange={(v) => setLeaveForm((p) => ({ ...p, leaveTypeId: v }))} options={leaveTypes.map((t) => ({ value: t.id, label: `${t.name}${t.isPaid ? " (paid)" : ""}` }))} placeholder="Select leave type" required />
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Start Date" type="date" value={leaveForm.startDate} onChange={(v) => setLeaveForm((p) => ({ ...p, startDate: v }))} required />
            <FormInput label="End Date" type="date" value={leaveForm.endDate} onChange={(v) => setLeaveForm((p) => ({ ...p, endDate: v }))} required />
          </div>
          <FormTextarea label="Reason" value={leaveForm.reason} onChange={(v) => setLeaveForm((p) => ({ ...p, reason: v }))} placeholder="Optional — add context for your manager" />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
          <Button onClick={submitLeave} loading={saving}>Submit Request</Button>
        </div>
      </Modal>

      {/* Material request modal */}
      <Modal open={modal === "material"} onClose={() => setModal(null)} title="Request Material" size="md">
        <div className="space-y-4">
          <FormSelect
            label="Project"
            value={materialForm.projectId}
            onChange={(v) => setMaterialForm((p) => ({ ...p, projectId: v }))}
            options={myProjects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
            required
          />
          <FormSelect
            label="Material"
            value={materialForm.materialId}
            onChange={(v) => setMaterialForm((p) => ({ ...p, materialId: v }))}
            options={[
              { value: "", label: "— Pick a material —" },
              ...materialOptions.map((m) => ({ value: m.id, label: `${m.name} (${Number(m.stockQty)} ${m.unit} in stock)` })),
            ]}
            required
          />
          <FormInput label="Quantity" type="number" value={materialForm.quantity} onChange={(v) => setMaterialForm((p) => ({ ...p, quantity: v }))} required />
          <p className="text-[10px] text-[#9B93B8] italic">Your request will be reviewed by the project manager. Approved requests deduct from stock.</p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
          <Button onClick={submitMaterial} loading={saving}>Submit Request</Button>
        </div>
      </Modal>

      {/* Ticket modal */}
      <Modal open={modal === "ticket"} onClose={() => setModal(null)} title="Submit IT Ticket" size="md">
        <div className="space-y-4">
          <FormInput label="Title" value={ticketForm.title} onChange={(v) => setTicketForm((p) => ({ ...p, title: v }))} required placeholder="Brief summary of the issue" />
          <FormTextarea label="Description" value={ticketForm.description} onChange={(v) => setTicketForm((p) => ({ ...p, description: v }))} required placeholder="Steps to reproduce, error messages, impact..." />
          <div className="grid grid-cols-2 gap-3">
            <FormSelect label="Category" value={ticketForm.category} onChange={(v) => setTicketForm((p) => ({ ...p, category: v }))} options={[
              { value: "hardware", label: "Hardware" }, { value: "software", label: "Software" },
              { value: "network", label: "Network" }, { value: "access", label: "Access / Permissions" },
              { value: "other", label: "Other" },
            ]} />
            <FormSelect label="Priority" value={ticketForm.priority} onChange={(v) => setTicketForm((p) => ({ ...p, priority: v }))} options={[
              { value: "low", label: "Low" }, { value: "medium", label: "Medium" },
              { value: "high", label: "High" }, { value: "critical", label: "Critical" },
            ]} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
          <Button onClick={submitTicket} loading={saving}>Submit Ticket</Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
