import { useState, useEffect, useCallback, useMemo } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, ConfirmDialog, Toast } from "../../components/ui/Modal";
import { BarChartWidget } from "../../components/charts/Charts";
import { HardHat, Plus, Search, MapPin, Calendar, DollarSign, TrendingUp, Edit, Package, Trash2, Users, Boxes, Truck } from "lucide-react";
import { formatCurrency, formatDate, formatPercent } from "../../utils/formatters";
import api from "../../api/client";
import type { Project, Material, Supplier } from "../../types";

type Tab = "projects" | "materials" | "suppliers";

const emptyForm = {
  name: "", code: "", description: "", clientName: "",
  startDate: "", endDate: "", estimatedBudget: "", location: "",
  budgetCategoryId: "", teamMemberIds: [] as string[],
};

const emptyMaterialForm = {
  name: "", code: "", category: "Concrete", unit: "bags",
  unitPrice: "", stockQty: "", reorderLevel: "", supplier: "",
};

type BudgetCategory = { id: string; name: string; type: string };

type EmployeeOption = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  position: string;
  department?: { name?: string } | null;
};

type ProjectMaterialRequest = {
  id: string;
  quantity: number;
  status: string;
  requestedBy: string;
  material: { id: string; name: string; unit: string };
};

const MATERIAL_CATEGORIES = ["Concrete", "Steel", "Lumber", "Electrical", "Plumbing", "Finishing", "Safety", "Tools", "Other"];

export default function Projects() {
  const [tab, setTab] = useState<Tab>("projects");

  return (
    <PageWrapper title="Projects" subtitle="Projects - Project management">
      <div className="mb-6 flex gap-2 border-b border-[#E8E4F3] dark:border-[#2E2850]">
        <TabButton active={tab === "projects"} onClick={() => setTab("projects")} icon={<HardHat size={14} />}>Projects</TabButton>
        <TabButton active={tab === "materials"} onClick={() => setTab("materials")} icon={<Boxes size={14} />}>Materials &amp; Stock</TabButton>
        <TabButton active={tab === "suppliers"} onClick={() => setTab("suppliers")} icon={<Truck size={14} />}>Suppliers</TabButton>
      </div>
      {tab === "projects" && <ProjectsPanel />}
      {tab === "materials" && <MaterialsPanel />}
      {tab === "suppliers" && <SuppliersPanel />}
    </PageWrapper>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
        active
          ? "border-[#5B21B6] text-[#5B21B6]"
          : "border-transparent text-[#9B93B8] hover:text-[#4C4566] dark:hover:text-[#B8AEDD]"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── PROJECTS PANEL ────────────────────────────────────────

function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [progressInput, setProgressInput] = useState<{ id: string; value: number } | null>(null);
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [empSearch, setEmpSearch] = useState("");

  const [materialsModal, setMaterialsModal] = useState<{ projectId: string; projectName: string } | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [projectRequests, setProjectRequests] = useState<ProjectMaterialRequest[]>([]);
  const [materialForm, setMaterialForm] = useState({ materialId: "", quantity: "" });
  const [materialsLoading, setMaterialsLoading] = useState(false);

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

  useEffect(() => {
    api.get("/finance/budget-categories?limit=100")
      .then((r) => setBudgetCategories((r.data.data || []).filter((c: BudgetCategory) => c.type === "expense")))
      .catch(() => { /* silent */ });
    api.get("/hr/employees?limit=500&status=active")
      .then((r) => setEmployees(r.data.data || []))
      .catch(() => { /* silent */ });
  }, []);

  const empById = useMemo(() => {
    const m: Record<string, EmployeeOption> = {};
    for (const e of employees) m[e.id] = e;
    return m;
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    if (!empSearch.trim()) return employees;
    const q = empSearch.toLowerCase();
    return employees.filter((e) =>
      `${e.firstName} ${e.lastName} ${e.employeeCode} ${e.position}`.toLowerCase().includes(q)
    );
  }, [employees, empSearch]);

  const setField = <K extends keyof typeof emptyForm>(key: K, val: (typeof emptyForm)[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const toggleTeamMember = (id: string) => {
    setForm((prev) => ({
      ...prev,
      teamMemberIds: prev.teamMemberIds.includes(id)
        ? prev.teamMemberIds.filter((i) => i !== id)
        : [...prev.teamMemberIds, id],
    }));
  };

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setEmpSearch(""); setShowForm(true); };

  const openEdit = (p: Project) => {
    setForm({
      name: p.name, code: p.code, description: p.description || "", clientName: p.clientName || "",
      startDate: p.startDate.slice(0, 10), endDate: p.endDate?.slice(0, 10) || "",
      estimatedBudget: p.estimatedBudget ? String(p.estimatedBudget) : "", location: p.location || "",
      budgetCategoryId: p.budgetCategoryId || "",
      teamMemberIds: p.teamMemberIds || [],
    });
    setEditingId(p.id); setEmpSearch(""); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code || !form.startDate) {
      setToast({ message: "Name, code, and start date are required", type: "error" }); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        estimatedBudget: form.estimatedBudget ? Number(form.estimatedBudget) : undefined,
        budgetCategoryId: form.budgetCategoryId || null,
        teamMemberIds: form.teamMemberIds,
      };
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

  const openMaterials = async (p: Project) => {
    setMaterialsModal({ projectId: p.id, projectName: p.name });
    setMaterialForm({ materialId: "", quantity: "" });
    setMaterialsLoading(true);
    try {
      const [matsRes, reqsRes] = await Promise.all([
        api.get("/construction/materials?limit=100"),
        api.get(`/construction/material-requests?projectId=${p.id}&limit=50`),
      ]);
      setMaterials(matsRes.data.data || []);
      setProjectRequests(reqsRes.data.data || []);
    } catch { setMaterials([]); setProjectRequests([]); }
    finally { setMaterialsLoading(false); }
  };

  const refreshProjectRequests = async (projectId: string) => {
    try {
      const res = await api.get(`/construction/material-requests?projectId=${projectId}&limit=50`);
      setProjectRequests(res.data.data || []);
    } catch { /* silent */ }
  };

  const addMaterialToProject = async () => {
    if (!materialsModal) return;
    if (!materialForm.materialId || !materialForm.quantity || Number(materialForm.quantity) <= 0) {
      setToast({ message: "Pick a material and a positive quantity", type: "error" }); return;
    }
    try {
      await api.post("/construction/material-requests", {
        projectId: materialsModal.projectId,
        materialId: materialForm.materialId,
        quantity: Number(materialForm.quantity),
        requestedBy: "Project manager",
      });
      setToast({ message: "Material added to project", type: "success" });
      setMaterialForm({ materialId: "", quantity: "" });
      refreshProjectRequests(materialsModal.projectId);
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to add", type: "error" });
    }
  };

  const approveMaterialRequest = async (id: string) => {
    if (!materialsModal) return;
    try {
      await api.put(`/construction/material-requests/${id}/status`, { status: "approved" });
      setToast({ message: "Material issued — stock updated", type: "success" });
      refreshProjectRequests(materialsModal.projectId);
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to approve", type: "error" });
    }
  };

  const rejectMaterialRequest = async (id: string) => {
    if (!materialsModal) return;
    try {
      await api.put(`/construction/material-requests/${id}/status`, { status: "rejected" });
      setToast({ message: "Material request rejected", type: "success" });
      refreshProjectRequests(materialsModal.projectId);
    } catch { setToast({ message: "Failed to reject", type: "error" }); }
  };

  const activeCount = projects.filter((p) => p.status === "active" || p.status === "in_progress").length;
  const totalBudget = projects.reduce((s, p) => s + (p.estimatedBudget || 0), 0);
  const avgProgress = projects.length > 0 ? projects.reduce((s, p) => s + p.progress, 0) / projects.length : 0;
  const progressData = projects.slice(0, 6).map((p) => ({ name: p.code, progress: p.progress }));
  const statusColorMap: Record<string, string> = { active: "bg-emerald-500", in_progress: "bg-emerald-500", completed: "bg-blue-500", planning: "bg-amber-500", on_hold: "bg-gray-400", cancelled: "bg-red-500" };

  return (
    <>
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
            projects.map((project) => {
              const teamCount = project.teamMemberIds?.length || 0;
              return (
                <Card key={project.id} className={project.status === "cancelled" ? "opacity-60" : ""}>
                  <CardBody>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-[#5B21B6]">{project.code}</span>
                          <Badge variant={project.status === "active" || project.status === "in_progress" ? "success" : project.status === "completed" ? "info" : project.status === "cancelled" ? "danger" : project.status === "planning" ? "warning" : "default"}>
                            {project.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <h3 className={`text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE] ${project.status === "cancelled" ? "line-through" : ""}`}>{project.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold font-serif text-[#5B21B6]">{project.progress}%</span>
                        <button onClick={() => openMaterials(project)} title="Materials" className="p-1.5 rounded-[6px] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] text-[#9B93B8] hover:text-[#5B21B6]"><Package size={14} /></button>
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
                      <span>{formatDate(project.startDate)} - {project.endDate ? formatDate(project.endDate) : "Ongoing"}</span>
                      {project.estimatedBudget && <span>Budget: {formatCurrency(project.estimatedBudget)}</span>}
                      {project.budgetCategoryId && (() => {
                        const cat = budgetCategories.find((c) => c.id === project.budgetCategoryId);
                        return cat ? <span className="text-[#5B21B6] font-medium">Linked: {cat.name}</span> : null;
                      })()}
                      {teamCount > 0 && (
                        <span className="text-[#5B21B6] font-medium flex items-center gap-0.5">
                          <Users size={10} />{teamCount} assigned
                        </span>
                      )}
                    </div>
                    {project.status !== "completed" && project.status !== "cancelled" && (
                      <div className="flex items-center gap-2">
                        {progressInput?.id === project.id ? (
                          <div className="flex items-center gap-1">
                            <input type="number" min={0} max={100} value={progressInput.value} onChange={(e) => setProgressInput({ id: project.id, value: Math.max(0, Math.min(100, Number(e.target.value))) })}
                              className="w-16 px-2 py-1 text-xs rounded-[6px] border border-[#E8E4F3] dark:border-[#2E2850] bg-white dark:bg-[#16122E] text-[#1E1B2E] dark:text-[#EDE9FE]" />
                            <Button variant="ghost" className="text-xs py-1 px-2" onClick={() => { updateProgress(project.id, progressInput.value); setProgressInput(null); }}>Set</Button>
                            <Button variant="ghost" className="text-xs py-1 px-2" onClick={() => setProgressInput(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button variant="ghost" className="text-xs py-1 px-2" onClick={() => setProgressInput({ id: project.id, value: project.progress })}>Update %</Button>
                        )}
                        <Button variant="ghost" className="text-xs py-1 px-2" onClick={() => updateStatus(project.id, "completed")}>Mark Complete</Button>
                        {project.status === "planning" && <Button variant="ghost" className="text-xs py-1 px-2" onClick={() => updateStatus(project.id, "active")}>Start</Button>}
                        {project.status !== "on_hold" && <Button variant="ghost" className="text-xs py-1 px-2" onClick={() => updateStatus(project.id, "on_hold")}>Hold</Button>}
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })
          }
        </div>
        <Card className="self-start">
          <div className="px-5 py-4 border-b border-[#E8E4F3] dark:border-[#2E2850]">
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Progress Overview</h3>
          </div>
          <div className="px-5 py-4">
            {progressData.length > 0 ? <BarChartWidget data={progressData} bars={[{ key: "progress", color: "#5B21B6" }]} xKey="name" height={220} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
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
          <FormSelect
            label="Finance Budget Category"
            value={form.budgetCategoryId}
            onChange={(v) => setField("budgetCategoryId", v)}
            options={[
              { value: "", label: "— None (no budget deduction) —" },
              ...budgetCategories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <div className="sm:col-span-2">
            <FormTextarea label="Description" value={form.description} onChange={(v) => setField("description", v)} />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#4C4566] dark:text-[#B8AEDD] mb-1">
              Assigned Team ({form.teamMemberIds.length})
            </label>
            <div className="border border-[#E8E4F3] dark:border-[#2E2850] rounded-[10px] bg-white dark:bg-[#16122E]">
              <div className="relative border-b border-[#E8E4F3] dark:border-[#2E2850]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
                <input
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder="Search employees to assign..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-transparent focus:outline-none text-[#1E1B2E] dark:text-[#EDE9FE]"
                />
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-[#E8E4F3] dark:divide-[#2E2850]">
                {filteredEmployees.length === 0 ? (
                  <p className="text-xs text-[#9B93B8] text-center py-4">No matching employees</p>
                ) : (
                  filteredEmployees.slice(0, 30).map((e) => {
                    const checked = form.teamMemberIds.includes(e.id);
                    return (
                      <label key={e.id} className="flex items-center gap-3 px-3 py-2 hover:bg-[#F8F6FF] dark:hover:bg-[#1F1A3B] cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={() => toggleTeamMember(e.id)} className="accent-[#5B21B6]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[#1E1B2E] dark:text-[#EDE9FE] truncate">{e.firstName} {e.lastName}</p>
                          <p className="text-[10px] text-[#9B93B8] truncate">{e.employeeCode} · {e.position}{e.department?.name ? ` · ${e.department.name}` : ""}</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              {form.teamMemberIds.length > 0 && (
                <div className="p-2 border-t border-[#E8E4F3] dark:border-[#2E2850] flex flex-wrap gap-1.5">
                  {form.teamMemberIds.map((id) => {
                    const e = empById[id];
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-full bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6] dark:text-[#B8AEDD]">
                        {e ? `${e.firstName} ${e.lastName}` : "Unknown"}
                        <button onClick={() => toggleTeamMember(id)} className="hover:text-red-600"><Trash2 size={10} /></button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingId ? "Save" : "Create"}</Button>
        </div>
      </Modal>

      <Modal open={!!materialsModal} onClose={() => setMaterialsModal(null)} title={`Materials — ${materialsModal?.projectName || ""}`} size="lg">
        {materialsLoading ? <LoadingSpinner /> : (
          <div className="space-y-5">
            <div>
              <h4 className="text-xs font-semibold text-[#4C4566] dark:text-[#B8AEDD] uppercase tracking-wide mb-2">Add Material</h4>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-3 items-end">
                <FormSelect
                  label="Material"
                  value={materialForm.materialId}
                  onChange={(v) => setMaterialForm((prev) => ({ ...prev, materialId: v }))}
                  options={[
                    { value: "", label: "— Pick a material —" },
                    ...materials.map((m) => ({ value: m.id, label: `${m.name} (${m.stockQty} ${m.unit} in stock)` })),
                  ]}
                />
                <FormInput label="Quantity" type="number" value={materialForm.quantity} onChange={(v) => setMaterialForm((prev) => ({ ...prev, quantity: v }))} />
                <Button onClick={addMaterialToProject}><Plus size={14} /> Add</Button>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[#4C4566] dark:text-[#B8AEDD] uppercase tracking-wide mb-2">Requested Materials</h4>
              {projectRequests.length === 0 ? (
                <p className="text-xs text-[#9B93B8] py-4 text-center">No materials requested yet</p>
              ) : (
                <div className="divide-y divide-[#E8E4F3] dark:divide-[#2E2850]">
                  {projectRequests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{r.material.name}</p>
                        <p className="text-[10px] text-[#9B93B8]">{r.quantity} {r.material.unit} · requested by {r.requestedBy}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.status === "approved" || r.status === "delivered" ? "success" : r.status === "rejected" ? "danger" : "warning"}>{r.status}</Badge>
                        {r.status === "pending" && (
                          <>
                            <Button variant="ghost" className="text-xs py-1 px-2" onClick={() => approveMaterialRequest(r.id)}>Issue</Button>
                            <button onClick={() => rejectMaterialRequest(r.id)} className="p-1.5 rounded-[6px] hover:bg-red-50 dark:hover:bg-red-900/20 text-[#9B93B8] hover:text-red-600"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[10px] text-[#9B93B8] italic">Approving a request deducts from material stock. Items at or below reorder level will appear in the admin Low Stock view.</p>
          </div>
        )}
      </Modal>
    </>
  );
}

// ─── MATERIALS PANEL ───────────────────────────────────────

function MaterialsPanel() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyMaterialForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (categoryFilter) params.set("category", categoryFilter);
      if (search) params.set("search", search);
      const [matsRes, supsRes] = await Promise.all([
        api.get(`/construction/materials?${params}`),
        api.get("/construction/suppliers"),
      ]);
      setMaterials(matsRes.data.data || []);
      setSuppliers(supsRes.data.data || []);
    } catch { setMaterials([]); setSuppliers([]); }
    finally { setLoading(false); }
  }, [search, categoryFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = <K extends keyof typeof emptyMaterialForm>(key: K, val: (typeof emptyMaterialForm)[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const openCreate = () => { setForm(emptyMaterialForm); setEditingId(null); setShowForm(true); };

  const openEdit = (m: Material) => {
    setForm({
      name: m.name, code: m.code, category: m.category, unit: m.unit,
      unitPrice: String(m.unitPrice), stockQty: String(m.stockQty),
      reorderLevel: String(m.reorderLevel), supplier: m.supplier || "",
    });
    setEditingId(m.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code || !form.category || !form.unit || form.unitPrice === "") {
      setToast({ message: "Name, code, category, unit, and unit price are required", type: "error" }); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        unitPrice: Number(form.unitPrice),
        stockQty: form.stockQty === "" ? undefined : Number(form.stockQty),
        reorderLevel: form.reorderLevel === "" ? undefined : Number(form.reorderLevel),
      };
      if (editingId) {
        await api.put(`/construction/materials/${editingId}`, payload);
        setToast({ message: "Material updated", type: "success" });
      } else {
        await api.post("/construction/materials", payload);
        setToast({ message: "Material added", type: "success" });
      }
      setShowForm(false); fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save";
      setToast({ message: msg, type: "error" });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/construction/materials/${deleteId}`);
      setToast({ message: "Material deleted", type: "success" });
      setDeleteId(null); fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to delete";
      setToast({ message: msg, type: "error" });
    } finally { setDeleting(false); }
  };

  const totalItems = materials.length;
  const lowStockCount = materials.filter((m) => Number(m.stockQty) <= Number(m.reorderLevel)).length;
  const totalValue = materials.reduce((s, m) => s + Number(m.stockQty) * Number(m.unitPrice), 0);

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Materials" value={String(totalItems)} icon={<Boxes size={20} />} />
        <StatCard title="Low Stock" value={String(lowStockCount)} subtitle="at or below reorder" icon={<TrendingUp size={20} />} />
        <StatCard title="Stock Value" value={formatCurrency(totalValue)} icon={<DollarSign size={20} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code, supplier..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Categories</option>
          {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <Button onClick={openCreate} className="ml-auto"><Plus size={16} /> Add Material</Button>
      </div>

      {loading ? <LoadingSpinner /> : materials.length === 0 ? <EmptyState title="No materials yet" description="Add stock items to track inventory" icon={<Boxes size={32} />} /> : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8F6FF] dark:bg-[#1F1A3B] border-b border-[#E8E4F3] dark:border-[#2E2850]">
                <tr className="text-left text-[10px] uppercase tracking-wide text-[#4C4566] dark:text-[#B8AEDD]">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Reorder</th>
                  <th className="px-4 py-3">Unit Price</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4F3] dark:divide-[#2E2850]">
                {materials.map((m) => {
                  const low = Number(m.stockQty) <= Number(m.reorderLevel);
                  return (
                    <tr key={m.id} className="hover:bg-[#F8F6FF]/50 dark:hover:bg-[#1F1A3B]/50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{m.name}</p>
                        <p className="text-[10px] font-mono text-[#9B93B8]">{m.code}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#4C4566] dark:text-[#B8AEDD]">{m.category}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-semibold ${low ? "text-red-600" : "text-[#1E1B2E] dark:text-[#EDE9FE]"}`}>
                          {Number(m.stockQty)} {m.unit}
                        </span>
                        {low && <Badge variant="danger" className="ml-2 text-[9px]">LOW</Badge>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#4C4566] dark:text-[#B8AEDD]">{Number(m.reorderLevel)} {m.unit}</td>
                      <td className="px-4 py-3 text-xs text-[#4C4566] dark:text-[#B8AEDD]">{formatCurrency(Number(m.unitPrice))}</td>
                      <td className="px-4 py-3 text-xs text-[#4C4566] dark:text-[#B8AEDD]">{m.supplier || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(m)} className="p-1.5 rounded-[6px] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] text-[#9B93B8] hover:text-[#5B21B6]"><Edit size={14} /></button>
                          <button onClick={() => setDeleteId(m.id)} className="p-1.5 rounded-[6px] hover:bg-red-50 dark:hover:bg-red-900/20 text-[#9B93B8] hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Material" : "Add Material"} size="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput label="Name" value={form.name} onChange={(v) => setField("name", v)} required />
          <FormInput label="Code" value={form.code} onChange={(v) => setField("code", v)} required placeholder="MAT-XXX" disabled={!!editingId} />
          <FormSelect
            label="Category"
            value={form.category}
            onChange={(v) => setField("category", v)}
            options={MATERIAL_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <FormInput label="Unit" value={form.unit} onChange={(v) => setField("unit", v)} required placeholder="bags, kg, m..." />
          <FormInput label="Unit Price" value={form.unitPrice} onChange={(v) => setField("unitPrice", v)} type="number" required />
          <FormInput label="Stock Quantity" value={form.stockQty} onChange={(v) => setField("stockQty", v)} type="number" />
          <FormInput label="Reorder Level" value={form.reorderLevel} onChange={(v) => setField("reorderLevel", v)} type="number" />
          <div>
            <FormSelect
              label="Supplier"
              value={form.supplier}
              onChange={(v) => setField("supplier", v)}
              options={[
                { value: "", label: suppliers.length === 0 ? "— No suppliers yet, add one in Suppliers tab —" : "— None —" },
                ...suppliers.map((s) => ({ value: s.name, label: s.name })),
              ]}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingId ? "Save" : "Add"}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete material?"
        message="This permanently removes the material from inventory. Materials with request history cannot be deleted — adjust stock to 0 instead."
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  );
}

// ─── SUPPLIERS PANEL ───────────────────────────────────────

const emptySupplierForm = {
  name: "", contactName: "", email: "", phone: "", address: "", notes: "",
};

function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptySupplierForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/construction/suppliers");
      setSuppliers(res.data.data || []);
    } catch { setSuppliers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter((s) =>
      [s.name, s.contactName, s.email, s.phone].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const setField = <K extends keyof typeof emptySupplierForm>(key: K, val: (typeof emptySupplierForm)[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const openCreate = () => { setForm(emptySupplierForm); setEditingId(null); setShowForm(true); };

  const openEdit = (s: Supplier) => {
    setForm({
      name: s.name,
      contactName: s.contactName || "",
      email: s.email || "",
      phone: s.phone || "",
      address: s.address || "",
      notes: s.notes || "",
    });
    setEditingId(s.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setToast({ message: "Supplier name is required", type: "error" }); return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/construction/suppliers/${editingId}`, form);
        setToast({ message: "Supplier updated", type: "success" });
      } else {
        await api.post("/construction/suppliers", form);
        setToast({ message: "Supplier added", type: "success" });
      }
      setShowForm(false); fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save";
      setToast({ message: msg, type: "error" });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/construction/suppliers/${deleteId}`);
      setToast({ message: "Supplier deleted", type: "success" });
      setDeleteId(null); fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to delete";
      setToast({ message: msg, type: "error" });
    } finally { setDeleting(false); }
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard title="Total Suppliers" value={String(suppliers.length)} icon={<Truck size={20} />} />
        <StatCard title="With Contact Info" value={String(suppliers.filter((s) => s.email || s.phone).length)} icon={<Users size={20} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <Button onClick={openCreate} className="ml-auto"><Plus size={16} /> Add Supplier</Button>
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState title="No suppliers yet" description="Create suppliers once, then pick them from the dropdown when adding materials." icon={<Truck size={32} />} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8F6FF] dark:bg-[#1F1A3B] border-b border-[#E8E4F3] dark:border-[#2E2850]">
                <tr className="text-left text-[10px] uppercase tracking-wide text-[#4C4566] dark:text-[#B8AEDD]">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4F3] dark:divide-[#2E2850]">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F8F6FF]/50 dark:hover:bg-[#1F1A3B]/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{s.name}</p>
                      {s.notes && <p className="text-[10px] text-[#9B93B8] line-clamp-1">{s.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#4C4566] dark:text-[#B8AEDD]">{s.contactName || "—"}</td>
                    <td className="px-4 py-3 text-xs text-[#4C4566] dark:text-[#B8AEDD]">{s.email || "—"}</td>
                    <td className="px-4 py-3 text-xs text-[#4C4566] dark:text-[#B8AEDD]">{s.phone || "—"}</td>
                    <td className="px-4 py-3 text-xs text-[#4C4566] dark:text-[#B8AEDD] max-w-xs truncate">{s.address || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-[6px] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] text-[#9B93B8] hover:text-[#5B21B6]"><Edit size={14} /></button>
                        <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded-[6px] hover:bg-red-50 dark:hover:bg-red-900/20 text-[#9B93B8] hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Supplier" : "Add Supplier"} size="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput label="Name" value={form.name} onChange={(v) => setField("name", v)} required />
          <FormInput label="Contact Person" value={form.contactName} onChange={(v) => setField("contactName", v)} />
          <FormInput label="Email" value={form.email} onChange={(v) => setField("email", v)} type="email" />
          <FormInput label="Phone" value={form.phone} onChange={(v) => setField("phone", v)} />
          <div className="sm:col-span-2">
            <FormInput label="Address" value={form.address} onChange={(v) => setField("address", v)} />
          </div>
          <div className="sm:col-span-2">
            <FormTextarea label="Notes" value={form.notes} onChange={(v) => setField("notes", v)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingId ? "Save" : "Add"}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete supplier?"
        message="Suppliers referenced by existing materials cannot be deleted until those materials are reassigned."
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  );
}
