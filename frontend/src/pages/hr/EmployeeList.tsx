import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, ConfirmDialog, Toast } from "../../components/ui/Modal";
import { Users, Plus, Search, UserCheck, Briefcase, Edit, Trash2 } from "lucide-react";
import { formatCurrency, formatDate, statusColor } from "../../utils/formatters";
import api from "../../api/client";
import HRSubNav from "./HRSubNav";
import type { Employee, Department, ApiMeta } from "../../types";

const emptyForm = {
  employeeCode: "", departmentId: "", firstName: "", lastName: "", email: "",
  phone: "", position: "", hireDate: "", salary: "", employmentType: "full_time",
  address: "", emergencyContact: "",
};

type JobRole = { id: string; name: string; level?: string | null; isActive: boolean };

export default function EmployeeList() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (deptFilter) params.set("departmentId", deptFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/hr/employees?${params}`);
      setEmployees(res.data.data || []);
      setMeta(res.data.meta || null);
    } catch {
      setEmployees([]);
    } finally { setLoading(false); }
  }, [page, deptFilter, statusFilter, search]);

  const fetchDepartments = async () => {
    try {
      const res = await api.get("/hr/departments");
      setDepartments(res.data.data || []);
    } catch { /* silent */ }
  };

  const fetchJobRoles = async () => {
    try {
      const res = await api.get("/hr/job-roles?isActive=true");
      setJobRoles(res.data.data || []);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchDepartments(); fetchJobRoles(); }, []);

  const setField = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (emp: Employee) => {
    setForm({
      employeeCode: emp.employeeCode,
      departmentId: emp.departmentId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone || "",
      position: emp.position,
      hireDate: emp.hireDate.slice(0, 10),
      salary: String(emp.salary),
      employmentType: emp.employmentType,
      address: emp.address || "",
      emergencyContact: emp.emergencyContact || "",
    });
    setEditingId(emp.id);
    setShowForm(true);
  };

  const openView = async (id: string) => {
    try {
      const res = await api.get(`/hr/employees/${id}`);
      setViewEmployee(res.data.data);
      setShowView(true);
    } catch {
      setToast({ message: "Failed to load employee details", type: "error" });
    }
  };

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.email || !form.position || !form.departmentId || !form.hireDate || !form.salary) {
      setToast({ message: "Please fill in all required fields", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        salary: Number(form.salary),
        employeeCode: form.employeeCode.trim() || undefined,
      };

      if (editingId) {
        await api.put(`/hr/employees/${editingId}`, payload);
        setToast({ message: "Employee updated successfully", type: "success" });
      } else {
        await api.post("/hr/employees", payload);
        setToast({ message: "Employee created successfully", type: "success" });
      }
      setShowForm(false);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save employee";
      setToast({ message: msg, type: "error" });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      await api.delete(`/hr/employees/${deleteId}`);
      setToast({ message: "Employee deleted", type: "success" });
      setShowDelete(false);
      setDeleteId(null);
      setShowView(false);
      setViewEmployee(null);
      fetchData();
    } catch {
      setToast({ message: "Failed to delete employee", type: "error" });
    } finally { setSaving(false); }
  };

  const activeCount = employees.filter((e) => e.status === "active").length;
  const deptOptions = departments.map((d) => ({ value: d.id, label: d.name }));
  const roleOptions = jobRoles.map((r) => ({ value: r.name, label: r.name }));

  return (
    <PageWrapper title="Employee Management" subtitle="HR - Employee directory">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <HRSubNav />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Employees" value={String(meta?.total || employees.length)} icon={<Users size={20} />} />
        <StatCard title="Active" value={String(activeCount)} icon={<UserCheck size={20} />} />
        <StatCard title="Departments" value={String(departments.length)} icon={<Briefcase size={20} />} />
        <StatCard title="Avg Salary" value={formatCurrency(employees.length > 0 ? employees.reduce((s, e) => s + e.salary, 0) / employees.length : 0)} icon={<Users size={20} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchData()} placeholder="Search employees..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Statuses</option>
          {["active", "on_leave", "terminated"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <Button onClick={openCreate} className="ml-auto"><Plus size={16} /> Add Employee</Button>
      </div>

      {loading ? <LoadingSpinner /> : employees.length === 0 ? <EmptyState title="No employees found" icon={<Users size={32} />} /> : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Code", "Name", "Department", "Position", "Hire Date", "Salary", "Status"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} onClick={() => openView(emp.id)}
                    className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F] cursor-pointer transition">
                    <td className="px-5 py-3 font-mono text-xs text-[#5B21B6]">{emp.employeeCode}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#EDE9FE] dark:bg-[#2D1F5E] flex items-center justify-center text-xs font-bold text-[#5B21B6]">
                          {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-[#1E1B2E] dark:text-[#EDE9FE] group-hover:underline">{emp.firstName} {emp.lastName}</p>
                          <p className="text-[10px] text-[#9B93B8]">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><Badge variant="purple">{emp.department?.name || "—"}</Badge></td>
                    <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{emp.position}</td>
                    <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{formatDate(emp.hireDate)}</td>
                    <td className="px-5 py-3 font-serif font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{formatCurrency(emp.salary)}</td>
                    <td className="px-5 py-3"><Badge className={statusColor(emp.status)}>{emp.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-[#9B93B8]">Page {meta.page} of {meta.totalPages} ({meta.total} total)</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>Previous</Button>
            <Button variant="ghost" onClick={() => setPage(page + 1)} disabled={page >= meta.totalPages}>Next</Button>
          </div>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Employee" : "Add Employee"} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput label="First Name" value={form.firstName} onChange={(v) => setField("firstName", v)} required />
          <FormInput label="Last Name" value={form.lastName} onChange={(v) => setField("lastName", v)} required />
          <FormInput label="Email" value={form.email} onChange={(v) => setField("email", v)} type="email" required />
          <FormInput label="Phone" value={form.phone} onChange={(v) => setField("phone", v)} placeholder="+60..." />
          <FormInput label="Employee Code" value={form.employeeCode} onChange={(v) => setField("employeeCode", v)} placeholder="Auto-generated if empty" disabled={!!editingId} />
          <FormSelect label="Department" value={form.departmentId} onChange={(v) => setField("departmentId", v)} options={deptOptions} required placeholder="Select department" />
          <FormSelect label="Job Role" value={form.position} onChange={(v) => setField("position", v)} options={roleOptions} required placeholder="Select role" />
          <FormInput label="Hire Date" value={form.hireDate} onChange={(v) => setField("hireDate", v)} type="date" required />
          <FormInput label="Salary" value={form.salary} onChange={(v) => setField("salary", v)} type="number" required />
          <FormSelect label="Employment Type" value={form.employmentType} onChange={(v) => setField("employmentType", v)} options={[
            { value: "full_time", label: "Full Time" }, { value: "part_time", label: "Part Time" },
            { value: "contract", label: "Contract" }, { value: "intern", label: "Intern" },
          ]} />
          <FormTextarea label="Address" value={form.address} onChange={(v) => setField("address", v)} />
          <FormInput label="Emergency Contact" value={form.emergencyContact} onChange={(v) => setField("emergencyContact", v)} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingId ? "Save Changes" : "Create Employee"}</Button>
        </div>
      </Modal>

      <Modal open={showView} onClose={() => { setShowView(false); setViewEmployee(null); }} title="Employee Details" size="lg">
        {viewEmployee && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ["Code", viewEmployee.employeeCode],
                ["Name", `${viewEmployee.firstName} ${viewEmployee.lastName}`],
                ["Email", viewEmployee.email],
                ["Phone", viewEmployee.phone || "—"],
                ["Department", viewEmployee.department?.name || "—"],
                ["Position", viewEmployee.position],
                ["Hire Date", formatDate(viewEmployee.hireDate)],
                ["Salary", formatCurrency(viewEmployee.salary)],
                ["Employment Type", viewEmployee.employmentType.replace("_", " ")],
                ["Status", viewEmployee.status],
                ["Address", viewEmployee.address || "—"],
                ["Emergency Contact", viewEmployee.emergencyContact || "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] font-medium text-[#9B93B8] uppercase">{label}</p>
                  <p className="text-sm text-[#1E1B2E] dark:text-[#EDE9FE]">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[#E8E4F3] dark:border-[#2E2850]">
              <Button variant="ghost" onClick={() => { setShowView(false); openEdit(viewEmployee); }}>
                <Edit size={14} /> Edit
              </Button>
              <Button variant="danger" onClick={() => { setDeleteId(viewEmployee.id); setShowDelete(true); }}>
                <Trash2 size={14} /> Delete
              </Button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={showDelete}
        onClose={() => { setShowDelete(false); setDeleteId(null); }}
        onConfirm={handleDelete}
        title="Delete Employee"
        message="Are you sure you want to delete this employee? This will permanently remove them and all related records."
        confirmLabel="Delete"
        loading={saving}
      />
    </PageWrapper>
  );
}
