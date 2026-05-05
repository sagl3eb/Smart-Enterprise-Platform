import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, ConfirmDialog, Toast } from "../../components/ui/Modal";
import { Briefcase, Plus, Edit, Trash2, Check } from "lucide-react";
import api from "../../api/client";
import HRSubNav from "./HRSubNav";

type JobRole = {
  id: string;
  name: string;
  description: string | null;
  level: string | null;
  isActive: boolean;
  createdAt: string;
};

const LEVEL_OPTIONS = [
  { value: "IC", label: "Individual Contributor" },
  { value: "Lead", label: "Lead" },
  { value: "Manager", label: "Manager" },
  { value: "Director", label: "Director" },
  { value: "VP", label: "Vice President" },
  { value: "C-Level", label: "C-Level Executive" },
];

const emptyForm = { name: "", description: "", level: "IC" };

export default function JobRoles() {
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/job-roles");
      setRoles(res.data.data || []);
    } catch {
      setRoles([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchRoles(); }, []);

  const setField = (key: keyof typeof emptyForm, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (r: JobRole) => {
    setForm({ name: r.name, description: r.description || "", level: r.level || "IC" });
    setEditingId(r.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setToast({ message: "Name is required", type: "error" }); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/hr/job-roles/${editingId}`, form);
        setToast({ message: "Job role updated", type: "success" });
      } else {
        await api.post("/hr/job-roles", form);
        setToast({ message: "Job role created", type: "success" });
      }
      setShowForm(false);
      fetchRoles();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save job role";
      setToast({ message: msg, type: "error" });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      const res = await api.delete(`/hr/job-roles/${deleteId}`);
      setToast({ message: res.data.message || "Job role deleted", type: "success" });
      setShowDelete(false);
      setDeleteId(null);
      fetchRoles();
    } catch {
      setToast({ message: "Failed to delete job role", type: "error" });
    } finally { setSaving(false); }
  };

  const handleToggle = async (r: JobRole) => {
    try {
      await api.put(`/hr/job-roles/${r.id}`, { isActive: !r.isActive });
      fetchRoles();
    } catch {
      setToast({ message: "Failed to toggle status", type: "error" });
    }
  };

  const activeCount = roles.filter((r) => r.isActive).length;

  return (
    <PageWrapper title="Job Roles" subtitle="HR - Job position catalog">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <HRSubNav />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Roles" value={String(roles.length)} icon={<Briefcase size={20} />} />
        <StatCard title="Active" value={String(activeCount)} icon={<Check size={20} />} />
        <StatCard title="Inactive" value={String(roles.length - activeCount)} icon={<Briefcase size={20} />} />
      </div>

      <div className="flex items-center justify-end mb-6">
        <Button onClick={openCreate}><Plus size={16} /> Add Job Role</Button>
      </div>

      {loading ? <LoadingSpinner /> : roles.length === 0 ? (
        <EmptyState title="No job roles yet" icon={<Briefcase size={32} />} />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Name", "Level", "Description", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]">
                    <td className="px-5 py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{r.name}</td>
                    <td className="px-5 py-3"><Badge variant="purple">{r.level || "—"}</Badge></td>
                    <td className="px-5 py-3 text-xs text-[#9B93B8] max-w-[280px] truncate">{r.description || "—"}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => handleToggle(r)}>
                        <Badge className={r.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}>
                          {r.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-[6px] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] text-[#9B93B8] hover:text-[#5B21B6]"><Edit size={14} /></button>
                        <button onClick={() => { setDeleteId(r.id); setShowDelete(true); }} className="p-1.5 rounded-[6px] hover:bg-red-50 dark:hover:bg-red-900/20 text-[#9B93B8] hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Job Role" : "Add Job Role"} size="md">
        <div className="grid grid-cols-1 gap-4">
          <FormInput label="Name" value={form.name} onChange={(v) => setField("name", v)} required placeholder="e.g., Senior Software Engineer" />
          <FormSelect label="Level" value={form.level} onChange={(v) => setField("level", v)} options={LEVEL_OPTIONS} />
          <FormTextarea label="Description" value={form.description} onChange={(v) => setField("description", v)} placeholder="Responsibilities, seniority band, etc." />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingId ? "Save Changes" : "Create Role"}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={showDelete}
        onClose={() => { setShowDelete(false); setDeleteId(null); }}
        onConfirm={handleDelete}
        title="Delete Job Role"
        message="If this role is currently assigned to employees, it will be deactivated instead of deleted."
        confirmLabel="Delete"
        loading={saving}
      />
    </PageWrapper>
  );
}
