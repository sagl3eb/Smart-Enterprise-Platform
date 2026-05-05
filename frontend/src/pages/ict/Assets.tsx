import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, ConfirmDialog, Toast } from "../../components/ui/Modal";
import EmployeePicker from "../../components/ui/EmployeePicker";
import { DonutChartWidget } from "../../components/charts/Charts";
import { Monitor, Plus, Search, DollarSign, ShieldCheck, AlertTriangle, Edit, Trash2, Tag } from "lucide-react";
import { formatCurrency, formatDate, statusColor } from "../../utils/formatters";
import api from "../../api/client";
import type { Asset } from "../../types";
import ICTSubNav from "./ICTSubNav";
import useAuthStore from "../../store/authStore";
import { loadCategories, saveCategories, buildAssetTag, type CategoryPrefix } from "../../utils/assetCategories";

const emptyForm = { assetTag: "", name: "", category: "Laptop", manufacturer: "", model: "", serialNumber: "", purchaseDate: "", purchasePrice: "", warrantyExpiry: "", assignedTo: "", location: "", notes: "", status: "active" };

export default function Assets() {
  const orgId = useAuthStore((s) => s.user?.organization?.id || null);
  const canWrite = useAuthStore((s) => s.canWriteModule());
  const [categoryOptions, setCategoryOptions] = useState<CategoryPrefix[]>(() => loadCategories(orgId));
  const [newCat, setNewCat] = useState({ category: "", prefix: "" });
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/ict/assets?${params}`);
      setAssets(res.data.data || []);
    } catch { setAssets([]); }
    finally { setLoading(false); }
  }, [categoryFilter, statusFilter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const persistCategories = (next: CategoryPrefix[]) => { saveCategories(orgId, next); setCategoryOptions(next); };
  const addCategory = () => {
    const name = newCat.category.trim();
    const prefix = newCat.prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!name || !prefix) { setToast({ message: "Category and prefix required", type: "error" }); return; }
    if (categoryOptions.some((c) => c.category.toLowerCase() === name.toLowerCase())) {
      setToast({ message: "Category already exists", type: "error" }); return;
    }
    persistCategories([...categoryOptions, { category: name, prefix }]);
    setNewCat({ category: "", prefix: "" });
    setToast({ message: `Added ${name} → ${prefix}-XXX`, type: "success" });
  };
  const removeCategory = (name: string) => persistCategories(categoryOptions.filter((c) => c.category !== name));

  const setField = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const openCreate = () => {
    const firstCat = categoryOptions[0]?.category || "Other";
    setForm({ ...emptyForm, category: firstCat, assetTag: buildAssetTag(orgId, firstCat) });
    setEditingId(null); setShowForm(true);
  };

  const openEdit = (a: Asset) => {
    setForm({
      assetTag: a.assetTag, name: a.name, category: a.category, manufacturer: a.manufacturer || "",
      model: a.model || "", serialNumber: a.serialNumber || "", purchaseDate: a.purchaseDate?.slice(0, 10) || "",
      purchasePrice: a.purchasePrice ? String(a.purchasePrice) : "", warrantyExpiry: a.warrantyExpiry?.slice(0, 10) || "",
      assignedTo: a.assignedTo || "", location: a.location || "", notes: "",
      status: a.status || "active",
    });
    setEditingId(a.id); setShowForm(true);
  };

  // When category changes during create, regenerate the tag so it uses the right prefix.
  const onCategoryChange = (v: string) => {
    setForm((prev) => ({
      ...prev,
      category: v,
      assetTag: editingId ? prev.assetTag : buildAssetTag(orgId, v),
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.category) { setToast({ message: "Name and category required", type: "error" }); return; }
    setSaving(true);
    try {
      const payload = { ...form, purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined, assetTag: form.assetTag || buildAssetTag(orgId, form.category) };
      if (editingId) {
        await api.put(`/ict/assets/${editingId}`, payload);
        setToast({ message: "Asset updated", type: "success" });
      } else {
        await api.post("/ict/assets", payload);
        setToast({ message: "Asset created", type: "success" });
      }
      setShowForm(false); fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save";
      setToast({ message: msg, type: "error" });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return; setSaving(true);
    try { await api.delete(`/ict/assets/${deleteId}`); setToast({ message: "Asset deleted", type: "success" }); setShowDelete(false); setDeleteId(null); fetchData(); }
    catch { setToast({ message: "Failed to delete", type: "error" }); }
    finally { setSaving(false); }
  };

  const totalValue = assets.reduce((s, a) => s + (a.purchasePrice || 0), 0);
  const activeCount = assets.filter((a) => a.status === "active").length;
  const categories = [...new Set(assets.map((a) => a.category))];
  const statusDonut = Object.entries(assets.reduce<Record<string, number>>((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {})).map(([name, value]) => ({ name, value }));

  return (
    <PageWrapper title="IT Assets" subtitle="ICT Management - Hardware inventory">
      <ICTSubNav />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Assets" value={String(assets.length)} icon={<Monitor size={20} />} />
        <StatCard title="Active" value={String(activeCount)} icon={<ShieldCheck size={20} />} />
        <StatCard title="Total Value" value={formatCurrency(totalValue)} icon={<DollarSign size={20} />} />
        <StatCard title="Expiring Warranty" value={String(assets.filter((a) => a.warrantyExpiry && new Date(a.warrantyExpiry) < new Date(Date.now() + 90 * 86400000) && new Date(a.warrantyExpiry) > new Date()).length)} icon={<AlertTriangle size={20} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchData()} placeholder="Search assets..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Statuses</option>
          {["active", "maintenance", "retired", "disposed"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button onClick={openCreate} className="ml-auto"><Plus size={16} /> Add Asset</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-3">
          {loading ? <LoadingSpinner /> : assets.length === 0 ? <EmptyState title="No assets found" icon={<Monitor size={32} />} /> : (
            <Card>
              <CardBody className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                    {["Tag", "Name", "Category", "Assigned To", "Location", "Value", "Status", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {assets.map((asset) => (
                      <tr key={asset.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]">
                        <td className="px-4 py-3 font-mono text-xs text-[#5B21B6]">{asset.assetTag}</td>
                        <td className="px-4 py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{asset.name}</td>
                        <td className="px-4 py-3"><Badge variant="purple">{asset.category}</Badge></td>
                        <td className="px-4 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{asset.assignedTo || "Unassigned"}</td>
                        <td className="px-4 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{asset.location || "—"}</td>
                        <td className="px-4 py-3 font-serif font-semibold">{asset.purchasePrice ? formatCurrency(asset.purchasePrice) : "—"}</td>
                        <td className="px-4 py-3"><Badge className={statusColor(asset.status)}>{asset.status}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(asset)} className="p-1.5 rounded-[6px] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] text-[#9B93B8] hover:text-[#5B21B6]"><Edit size={14} /></button>
                            <button onClick={() => { setDeleteId(asset.id); setShowDelete(true); }} className="p-1.5 rounded-[6px] hover:bg-red-50 dark:hover:bg-red-900/20 text-[#9B93B8] hover:text-red-500"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          )}
        </div>
        <Card>
          <div className="px-5 py-4 border-b border-[#E8E4F3] dark:border-[#2E2850]"><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">By Status</h3></div>
          <div className="px-5 py-4">
            {statusDonut.length > 0
              ? <DonutChartWidget data={statusDonut} height={260} innerRadius={55} outerRadius={90} />
              : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
          </div>
        </Card>
      </div>

      {canWrite && (
        <Card className="mt-6">
          <CardBody>
            <div className="flex items-center gap-2 mb-3">
              <Tag size={16} className="text-[#5B21B6]" />
              <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Asset Categories &amp; Tag Prefixes</h3>
            </div>
            <p className="text-xs text-[#9B93B8] mb-4">
              Define categories with a short prefix (e.g. &quot;Cisco Devices&quot; → <code className="px-1 rounded bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6]">CISCO-XXX</code>).
              New assets auto-generate tags using the selected category&apos;s prefix.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
              {categoryOptions.map((c) => (
                <div key={c.category} className="flex items-center justify-between px-3 py-2 rounded-[8px] border border-[#E8E4F3] dark:border-[#2E2850] bg-white dark:bg-[#16122E]">
                  <div>
                    <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{c.category}</p>
                    <p className="text-xs font-mono text-[#5B21B6]">{c.prefix}-XXXX</p>
                  </div>
                  <button onClick={() => removeCategory(c.category)} className="p-1.5 rounded-[6px] text-[#9B93B8] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3 pt-4 border-t border-[#E8E4F3] dark:border-[#2E2850]">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-[#9B93B8] mb-1">Category name</label>
                <input value={newCat.category} onChange={(e) => setNewCat((p) => ({ ...p, category: e.target.value }))} placeholder="Cisco Devices"
                  className="w-full px-3 py-2 rounded-[8px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
              </div>
              <div className="w-28">
                <label className="block text-xs font-medium text-[#9B93B8] mb-1">Prefix</label>
                <input value={newCat.prefix} onChange={(e) => setNewCat((p) => ({ ...p, prefix: e.target.value.toUpperCase() }))} placeholder="CISCO" maxLength={8}
                  className="w-full px-3 py-2 rounded-[8px] text-sm font-mono bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
              </div>
              <Button onClick={addCategory}><Plus size={14} /> Add Category</Button>
            </div>
          </CardBody>
        </Card>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Asset" : "Add Asset"} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput label="Asset Tag" value={form.assetTag} onChange={(v) => setField("assetTag", v)} disabled={!!editingId} />
          <FormInput label="Name" value={form.name} onChange={(v) => setField("name", v)} required />
          <FormSelect label="Category" value={form.category} onChange={onCategoryChange} required
            options={categoryOptions.map((c) => ({ value: c.category, label: `${c.category} (${c.prefix}-)` }))} />
          <FormSelect label="Status" value={form.status} onChange={(v) => setField("status", v)} options={[
            { value: "active", label: "Active" }, { value: "maintenance", label: "Maintenance" },
            { value: "retired", label: "Retired" }, { value: "disposed", label: "Disposed" },
          ]} />
          <FormInput label="Manufacturer" value={form.manufacturer} onChange={(v) => setField("manufacturer", v)} />
          <FormInput label="Model" value={form.model} onChange={(v) => setField("model", v)} />
          <FormInput label="Serial Number" value={form.serialNumber} onChange={(v) => setField("serialNumber", v)} />
          <FormInput label="Purchase Date" value={form.purchaseDate} onChange={(v) => setField("purchaseDate", v)} type="date" />
          <FormInput label="Purchase Price" value={form.purchasePrice} onChange={(v) => setField("purchasePrice", v)} type="number" />
          <FormInput label="Warranty Expiry" value={form.warrantyExpiry} onChange={(v) => setField("warrantyExpiry", v)} type="date" />
          <EmployeePicker label="Assigned To" value={form.assignedTo} onChange={(v) => setField("assignedTo", v)} />
          <FormInput label="Location" value={form.location} onChange={(v) => setField("location", v)} />
          <FormTextarea label="Notes" value={form.notes} onChange={(v) => setField("notes", v)} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingId ? "Save" : "Create"}</Button>
        </div>
      </Modal>

      <ConfirmDialog open={showDelete} onClose={() => { setShowDelete(false); setDeleteId(null); }} onConfirm={handleDelete}
        title="Delete Asset" message="Are you sure you want to delete this asset?" confirmLabel="Delete" loading={saving} />
    </PageWrapper>
  );
}
