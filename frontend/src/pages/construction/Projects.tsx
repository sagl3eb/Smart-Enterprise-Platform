import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, Toast } from "../../components/ui/Modal";
import { BarChartWidget } from "../../components/charts/Charts";
import { HardHat, Plus, Search, MapPin, Calendar, DollarSign, TrendingUp, Edit } from "lucide-react";
import { formatCurrency, formatDate, formatPercent } from "../../utils/formatters";
import api from "../../api/client";
import type { Project } from "../../types";

const emptyForm = { name: "", code: "", description: "", clientName: "", startDate: "", endDate: "", estimatedBudget: "", location: "" };

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/construction/projects?${params}`);
      setProjects(res.data.data || []);
    } catch { setProjects([]); }
    finally { setLoading(false); }
  }, [statusFilter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };

  const openEdit = (p: Project) => {
    setForm({
      name: p.name, code: p.code, description: p.description || "", clientName: p.clientName || "",
      startDate: p.startDate.slice(0, 10), endDate: p.endDate?.slice(0, 10) || "",
      estimatedBudget: p.estimatedBudget ? String(p.estimatedBudget) : "", location: p.location || "",
    });
    setEditingId(p.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code || !form.startDate) {
      setToast({ message: "Name, code, and start date are required", type: "error" }); return;
    }
    setSaving(true);
    try {
      const payload = { ...form, estimatedBudget: form.estimatedBudget ? Number(form.estimatedBudget) : undefined };
      if (editingId) {
        await api.put(`/construction/projects/${editingId}`, payload);
        setToast({ message: "Project updated", type: "success" });
      } else {
        await api.post("/construction/projects", payload);
        setToast({ message: "Project created", type: "success" });
      }
      setShowForm(false); fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save";
      setToast({ message: msg, type: "error" });
    } finally { setSaving(false); }
  };

  const updateProgress = async (id: string, progress: number) => {
    try {
      await api.put(`/construction/projects/${id}`, { progress });
      setToast({ message: "Progress updated", type: "success" }); fetchData();
    } catch { setToast({ message: "Failed to update progress", type: "error" }); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/construction/projects/${id}`, { status, ...(status === "completed" ? { progress: 100 } : {}) });
      setToast({ message: `Project ${status}`, type: "success" }); fetchData();
    } catch { setToast({ message: "Failed to update status", type: "error" }); }
  };

  const activeCount = projects.filter((p) => p.status === "active" || p.status === "in_progress").length;
  const totalBudget = projects.reduce((s, p) => s + (p.estimatedBudget || 0), 0);
  const avgProgress = projects.length > 0 ? projects.reduce((s, p) => s + p.progress, 0) / projects.length : 0;
  const progressData = projects.slice(0, 6).map((p) => ({ name: p.code, progress: p.progress }));
  const statusColorMap: Record<string, string> = { active: "bg-emerald-500", in_progress: "bg-emerald-500", completed: "bg-blue-500", planning: "bg-amber-500", on_hold: "bg-gray-400", cancelled: "bg-red-500" };

  return (
    <PageWrapper title="Construction Projects" subtitle="Construction Logistics — Project management">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Projects" value={String(projects.length)} icon={<HardHat size={20} />} />
        <StatCard title="Active" value={String(activeCount)} icon={<TrendingUp size={20} />} />
        <StatCard title="Total Budget" value={formatCurrency(totalBudget)} icon={<DollarSign size={20} />} />
        <StatCard title="Avg Progress" value={formatPercent(avgProgress)} icon={<Calendar size={20} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchData()} placeholder="Search projects..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Statuses</option>
          {["planning", "active", "in_progress", "on_hold", "completed", "cancelled"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <Button onClick={openCreate} className="ml-auto"><Plus size={16} /> New Project</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {loading ? <LoadingSpinner /> : projects.length === 0 ? <EmptyState title="No projects found" icon={<HardHat size={32} />} /> :
            projects.map((project) => (
              <Card key={project.id}>
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-[#5B21B6]">{project.code}</span>
                        <Badge variant={project.status === "active" || project.status === "in_progress" ? "success" : project.status === "completed" ? "info" : project.status === "planning" ? "warning" : "default"}>
                          {project.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{project.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold font-serif text-[#5B21B6]">{project.progress}%</span>
                      <button onClick={() => openEdit(project)} className="p-1.5 rounded-[6px] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] text-[#9B93B8] hover:text-[#5B21B6]"><Edit size={14} /></button>
                    </div>
                  </div>
                  {project.description && <p className="text-xs text-[#9B93B8] mb-3 line-clamp-1">{project.description}</p>}
                  <div className="h-2 bg-[#EDE9FE] dark:bg-[#2D1F5E] rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all ${statusColorMap[project.status] || "bg-[#5B21B6]"}`} style={{ width: `${project.progress}%` }} />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-[10px] text-[#9B93B8] mb-3">
                    {project.clientName && <span>Client: {project.clientName}</span>}
                    {project.location && <span className="flex items-center gap-0.5"><MapPin size={10} />{project.location}</span>}
                    <span>{formatDate(project.startDate)} — {project.endDate ? formatDate(project.endDate) : "Ongoing"}</span>
                    {project.estimatedBudget && <span>Budget: {formatCurrency(project.estimatedBudget)}</span>}
                  </div>
                  {project.status !== "completed" && project.status !== "cancelled" && (
                    <div className="flex gap-2">
                      <Button variant="ghost" className="text-xs py-1 px-2" onClick={() => updateProgress(project.id, Math.min(100, project.progress + 10))}>+10%</Button>
                      <Button variant="ghost" className="text-xs py-1 px-2" onClick={() => updateStatus(project.id, "completed")}>Mark Complete</Button>
                      {project.status === "planning" && <Button variant="ghost" className="text-xs py-1 px-2" onClick={() => updateStatus(project.id, "active")}>Start</Button>}
                      {project.status !== "on_hold" && <Button variant="ghost" className="text-xs py-1 px-2" onClick={() => updateStatus(project.id, "on_hold")}>Hold</Button>}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))
          }
        </div>
        <Card>
          <div className="px-5 py-4 border-b border-[#E8E4F3] dark:border-[#2E2850]">
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Progress Overview</h3>
          </div>
          <div className="px-5 py-4">
            {progressData.length > 0 ? <BarChartWidget data={progressData} bars={[{ key: "progress", color: "#5B21B6" }]} xKey="name" height={300} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
          </div>
        </Card>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Project" : "New Project"} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput label="Project Name" value={form.name} onChange={(v) => setField("name", v)} required />
          <FormInput label="Code" value={form.code} onChange={(v) => setField("code", v)} required placeholder="PRJ-XXX" disabled={!!editingId} />
          <FormInput label="Client" value={form.clientName} onChange={(v) => setField("clientName", v)} />
          <FormInput label="Location" value={form.location} onChange={(v) => setField("location", v)} />
          <FormInput label="Start Date" value={form.startDate} onChange={(v) => setField("startDate", v)} type="date" required />
          <FormInput label="End Date" value={form.endDate} onChange={(v) => setField("endDate", v)} type="date" />
          <FormInput label="Estimated Budget" value={form.estimatedBudget} onChange={(v) => setField("estimatedBudget", v)} type="number" />
          <FormTextarea label="Description" value={form.description} onChange={(v) => setField("description", v)} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingId ? "Save" : "Create"}</Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
