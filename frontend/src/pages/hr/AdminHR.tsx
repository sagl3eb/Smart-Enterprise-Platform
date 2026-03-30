import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormTextarea, Button, Toast } from "../../components/ui/Modal";
import { BarChartWidget } from "../../components/charts/Charts";
import { Users, Building, ClipboardCheck, Award, Plus, Check, X } from "lucide-react";
import { formatDate } from "../../utils/formatters";
import api from "../../api/client";
import type { Department, LeaveRequest } from "../../types";

export default function AdminHR() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: "", code: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, deptRes, leaveRes] = await Promise.allSettled([
        api.get("/hr/stats"),
        api.get("/hr/departments"),
        api.get("/hr/leave-requests?status=pending&limit=20"),
      ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data.data);
      if (deptRes.status === "fulfilled") setDepartments(deptRes.value.data.data || []);
      if (leaveRes.status === "fulfilled") setPendingLeaves(leaveRes.value.data.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createDept = async () => {
    if (!deptForm.name || !deptForm.code) { setToast({ message: "Name and code required", type: "error" }); return; }
    setSaving(true);
    try {
      await api.post("/hr/departments", deptForm);
      setToast({ message: "Department created", type: "success" }); setShowDeptForm(false); fetchData();
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed", type: "error" });
    } finally { setSaving(false); }
  };

  const handleLeave = async (id: string, action: "approve" | "reject") => {
    try {
      await api.put(`/hr/leave-requests/${id}/${action}`);
      setToast({ message: `Leave ${action}d`, type: "success" }); fetchData();
    } catch { setToast({ message: `Failed to ${action}`, type: "error" }); }
  };

  if (loading) return <PageWrapper title="HR Administration" subtitle="Admin View"><LoadingSpinner /></PageWrapper>;

  const s = stats as { totalEmployees?: number; activeEmployees?: number; departmentCount?: number; pendingLeaves?: number; averageSalary?: number; employmentTypeBreakdown?: Array<{ type: string; count: number }> } | null;
  const deptChartData = departments.map((d) => ({ name: d.name, employees: d._count?.employees || 0 }));

  return (
    <PageWrapper title="HR Administration" subtitle="Admin View — Departments, Leave Approvals, Workforce Stats">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Employees" value={String(s?.totalEmployees || 0)} icon={<Users size={20} />} />
        <StatCard title="Active" value={String(s?.activeEmployees || 0)} icon={<Users size={20} />} />
        <StatCard title="Departments" value={String(s?.departmentCount || departments.length)} icon={<Building size={20} />} />
        <StatCard title="Pending Leaves" value={String(s?.pendingLeaves || pendingLeaves.length)} icon={<ClipboardCheck size={20} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Departments */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Departments</h3>
            <Button className="text-xs py-1.5 px-3" onClick={() => { setDeptForm({ name: "", code: "", description: "" }); setShowDeptForm(true); }}><Plus size={14} /> Add</Button>
          </CardHeader>
          <CardBody className="space-y-2">
            {departments.length === 0 ? <EmptyState title="No departments" icon={<Building size={24} />} /> :
              departments.map((dept) => (
                <div key={dept.id} className="flex items-center justify-between py-2 border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{dept.name}</p>
                    <p className="text-[10px] text-[#9B93B8]">{dept.code} · {dept._count?.employees || 0} employees</p>
                  </div>
                  <Badge variant={dept.isActive ? "success" : "default"}>{dept.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              ))}
          </CardBody>
        </Card>

        {/* Department Chart */}
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Headcount by Department</h3></CardHeader>
          <CardBody>
            {deptChartData.length > 0 ? <BarChartWidget data={deptChartData} bars={[{ key: "employees", color: "#5B21B6" }]} xKey="name" height={280} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
          </CardBody>
        </Card>
      </div>

      {/* Pending Leave Approvals */}
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]"><ClipboardCheck size={16} className="inline mr-2" />Pending Leave Approvals</h3></CardHeader>
        <CardBody>
          {pendingLeaves.length === 0 ? <EmptyState title="No pending leave requests" icon={<Award size={24} />} /> : (
            <table className="w-full text-sm"><thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
              {["Employee", "Type", "Dates", "Days", "Reason", "Actions"].map((h) => <th key={h} className="text-left px-4 py-2 text-xs font-medium text-[#9B93B8]">{h}</th>)}
            </tr></thead><tbody>
              {pendingLeaves.map((lr) => (
                <tr key={lr.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                  <td className="px-4 py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{lr.employee?.firstName} {lr.employee?.lastName}</td>
                  <td className="px-4 py-3"><Badge variant="purple">{lr.leaveType?.name}</Badge></td>
                  <td className="px-4 py-3 text-xs text-[#4C4566] dark:text-[#B8AEDD]">{formatDate(lr.startDate)} — {formatDate(lr.endDate)}</td>
                  <td className="px-4 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{lr.totalDays}</td>
                  <td className="px-4 py-3 text-xs text-[#9B93B8] max-w-[150px] truncate">{lr.reason || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => handleLeave(lr.id, "approve")} className="p-1.5 rounded-[6px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100"><Check size={14} /></button>
                      <button onClick={() => handleLeave(lr.id, "reject")} className="p-1.5 rounded-[6px] bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100"><X size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody></table>
          )}
        </CardBody>
      </Card>

      <Modal open={showDeptForm} onClose={() => setShowDeptForm(false)} title="Create Department" size="sm">
        <div className="space-y-4">
          <FormInput label="Name" value={deptForm.name} onChange={(v) => setDeptForm((p) => ({ ...p, name: v }))} required />
          <FormInput label="Code" value={deptForm.code} onChange={(v) => setDeptForm((p) => ({ ...p, code: v }))} required placeholder="e.g. ENG, SAL" />
          <FormTextarea label="Description" value={deptForm.description} onChange={(v) => setDeptForm((p) => ({ ...p, description: v }))} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowDeptForm(false)}>Cancel</Button>
          <Button onClick={createDept} loading={saving}>Create</Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
