import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormTextarea, Button, ConfirmDialog, Toast } from "../../components/ui/Modal";
import { Building2, Plus, Edit, Trash2, Users } from "lucide-react";
import api from "../../api/client";
import HRSubNav from "./HRSubNav";

type Department = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  _count?: { employees: number };
};

const emptyForm = { name: "", code: "", description: "" };

export default function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/departments");
      setDepartments(res.data.data || []);
    } catch {
      setDepartments([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchDepartments(); }, []);

  const setField = (key: keyof typeof emptyForm, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (d: Department) => {
    setForm({ name: d.name, code: d.code, description: d.description || "" });
    setEditingId(d.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setToast({ message: "Name and code are required", type: "error" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/hr/departments/${editingId}`, form);
        setToast({ message: "Department updated", type: "success" });
      } else {
        await api.post("/hr/departments", form);
        setToast({ message: "Department created", type: "success" });
      }
      setShowForm(false);
      fetchDepartments();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save department";
      setToast({ message: msg, type: "error" });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      await api.delete(`/hr/departments/${deleteId}`);
      setToast({ message: "Department deleted", type: "success" });
      setShowDelete(false);
      setDeleteId(null);
      fetchDepartments();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to delete department";
      setToast({ message: msg, type: "error" });
    } finally { setSaving(false); }
  };

  const activeCount = departments.filter((d) => d.isActive).length;
  const totalEmployees = departments.reduce((sum, d) => sum + (d._count?.employees || 0), 0);

  return (
    <PageWrapper title="Departments" subtitle="HR - Organizational departments">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <HRSubNav />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Departments" value={String(departments.length)} icon={<Building2 size={20} />} />
        <StatCard title="Active" value={String(activeCount)} icon={<Building2 size={20} />} />
        <StatCard title="Total Employees" value={String(totalEmployees)} icon={<Users size={20} />} />
      </div>

      <div className="flex items-center justify-end mb-6">
        <Button onClick={openCreate}><Plus size={16} /> Add Department</Button>
      </div>

      {loading ? <LoadingSpinner /> : departments.length === 0 ? (
        <EmptyState title="No departments yet" icon={<Building2 size={32} />} />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Code", "Name", "Description", "Employees", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]">
                    <td className="px-5 py-3 font-mono text-xs text-[#5B21B6]">{d.code}</td>
                    <td className="px-5 py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{d.name}</td>
                    <td className="px-5 py-3 text-xs text-[#9B93B8] max-w-[280px] truncate">{d.description || "—"}</td>
                    <td className="px-5 py-3"><Badge variant="purple">{d._count?.employees || 0}</Badge></td>
                    <td className="px-5 py-3">
                      <Badge className={d.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}>
                        {d.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(d)} className="p-1.5 rounded-[6px] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] text-[#9B93B8] hover:text-[#5B21B6]"><Edit size={14} /></button>
                        <button onClick={() => { setDeleteId(d.id); setShowDelete(true); }} className="p-1.5 rounded-[6px] hover:bg-red-50 dark:hover:bg-red-900/20 text-[#9B93B8] hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Department" : "Add Department"} size="md">
        <div className="grid grid-cols-1 gap-4">
          <FormInput label="Name" value={form.name} onChange={(v) => setField("name", v)} required placeholder="e.g., Engineering" />
          <FormInput label="Code" value={form.code} onChange={(v) => setField("code", v)} required placeholder="e.g., ENG" />
          <FormTextarea label="Description" value={form.description} onChange={(v) => setField("description", v)} placeholder="Short description of the department" />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingId ? "Save Changes" : "Create Department"}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={showDelete}
        onClose={() => { setShowDelete(false); setDeleteId(null); }}
        onConfirm={handleDelete}
        title="Delete Department"
        message="Are you sure? If employees are assigned, the department will be deactivated instead of deleted."
        confirmLabel="Delete"
        loading={saving}
      />
    </PageWrapper>
  );
}
