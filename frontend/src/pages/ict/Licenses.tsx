import { useState, useEffect, useCallback, useMemo } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, ConfirmDialog, Toast } from "../../components/ui/Modal";
import { Key, Plus, Search, DollarSign, AlertTriangle, Edit, Trash2, Users } from "lucide-react";
import { formatCurrency, formatDate } from "../../utils/formatters";
import api from "../../api/client";
import ICTSubNav from "./ICTSubNav";

interface License {
  id: string;
  softwareName: string;
  vendor: string | null;
  licenseKey: string | null;
  licenseType: string;
  totalSeats: number;
  usedSeats: number;
  purchaseDate: string;
  expiryDate: string | null;
  annualCost: number | null;
  status: string;
  notes: string | null;
}

interface EmployeeOption {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  position: string;
  department?: { name?: string } | null;
}

const emptyForm = {
  softwareName: "", vendor: "", licenseKey: "", licenseType: "subscription",
  totalSeats: "1", purchaseDate: "", expiryDate: "", annualCost: "", notes: "",
  assignedIds: [] as string[],
};

const LICENSE_TYPES = [
  { value: "subscription", label: "Subscription" },
  { value: "perpetual", label: "Perpetual" },
  { value: "volume", label: "Volume" },
  { value: "oem", label: "OEM" },
];

const ASSIGN_TAG = /^\[assigned:([0-9a-f,\-]*)\]\s*\n?/i;

function decodeAssignments(notes: string | null | undefined): { assignedIds: string[]; cleanNotes: string } {
  if (!notes) return { assignedIds: [], cleanNotes: "" };
  const m = notes.match(ASSIGN_TAG);
  if (!m) return { assignedIds: [], cleanNotes: notes };
  const ids = m[1].split(",").map((s) => s.trim()).filter(Boolean);
  return { assignedIds: ids, cleanNotes: notes.replace(ASSIGN_TAG, "") };
}

function encodeAssignments(ids: string[], notes: string | undefined): string {
  const clean = (notes ?? "").trim();
  if (ids.length === 0) return clean;
  return `[assigned:${ids.join(",")}]\n${clean}`;
}

export default function Licenses() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [empSearch, setEmpSearch] = useState("");

  const fetchLicenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/ict/licenses?${params}`);
      setLicenses(res.data.data || []);
    } catch { setLicenses([]); }
    finally { setLoading(false); }
  }, [statusFilter, search]);

  useEffect(() => { fetchLicenses(); }, [fetchLicenses]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/hr/employees?limit=500&status=active");
        setEmployees(res.data.data || []);
      } catch { setEmployees([]); }
    })();
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

  const toggleAssignee = (empId: string) => {
    setForm((prev) => {
      const next = prev.assignedIds.includes(empId)
        ? prev.assignedIds.filter((i) => i !== empId)
        : [...prev.assignedIds, empId];
      return { ...prev, assignedIds: next };
    });
  };

  const openCreate = () => {
    setForm({ ...emptyForm, purchaseDate: new Date().toISOString().slice(0, 10) });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (lic: License) => {
    const { assignedIds, cleanNotes } = decodeAssignments(lic.notes);
    setForm({
      softwareName: lic.softwareName,
      vendor: lic.vendor || "",
      licenseKey: lic.licenseKey || "",
      licenseType: lic.licenseType,
      totalSeats: String(lic.totalSeats),
      purchaseDate: lic.purchaseDate.slice(0, 10),
      expiryDate: lic.expiryDate ? lic.expiryDate.slice(0, 10) : "",
      annualCost: lic.annualCost ? String(lic.annualCost) : "",
      notes: cleanNotes,
      assignedIds,
    });
    setEditingId(lic.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.softwareName || !form.totalSeats || !form.purchaseDate) {
      setToast({ message: "Software name, total seats, and purchase date are required", type: "error" }); return;
    }
    if (form.assignedIds.length > Number(form.totalSeats)) {
      setToast({ message: "Assigned employees exceed total seats", type: "error" }); return;
    }
    setSaving(true);
    try {
      const payload = {
        softwareName: form.softwareName,
        vendor: form.vendor,
        licenseKey: form.licenseKey,
        licenseType: form.licenseType,
        totalSeats: Number(form.totalSeats),
        usedSeats: form.assignedIds.length,
        purchaseDate: form.purchaseDate,
        expiryDate: form.expiryDate || undefined,
        annualCost: form.annualCost ? Number(form.annualCost) : undefined,
        notes: encodeAssignments(form.assignedIds, form.notes),
      };
      if (editingId) {
        await api.put(`/ict/licenses/${editingId}`, payload);
        setToast({ message: "License updated", type: "success" });
      } else {
        await api.post("/ict/licenses", payload);
        setToast({ message: "License added", type: "success" });
      }
      setShowForm(false); fetchLicenses();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save";
      setToast({ message: msg, type: "error" });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return; setSaving(true);
    try {
      await api.delete(`/ict/licenses/${deleteId}`);
      setToast({ message: "License removed", type: "success" });
      setShowDelete(false); setDeleteId(null); fetchLicenses();
    } catch { setToast({ message: "Failed to remove", type: "error" }); }
    finally { setSaving(false); }
  };

  const totalSeats = licenses.reduce((s, l) => s + l.totalSeats, 0);
  const usedSeats = licenses.reduce((s, l) => s + decodeAssignments(l.notes).assignedIds.length, 0);
  const totalCost = licenses.reduce((s, l) => s + (l.annualCost || 0), 0);
  const expiringSoon = licenses.filter((l) => l.expiryDate && new Date(l.expiryDate) < new Date(Date.now() + 90 * 86400000) && new Date(l.expiryDate) > new Date()).length;

  return (
    <PageWrapper title="Software Licenses" subtitle="ICT Management - License inventory & seat tracking">
      <ICTSubNav />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Licenses" value={String(licenses.length)} icon={<Key size={20} />} />
        <StatCard title="Seats (Used / Total)" value={`${usedSeats} / ${totalSeats}`} icon={<Users size={20} />} />
        <StatCard title="Annual Cost" value={formatCurrency(totalCost)} icon={<DollarSign size={20} />} />
        <StatCard title="Expiring <90d" value={String(expiringSoon)} icon={<AlertTriangle size={20} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchLicenses()} placeholder="Search software or vendor..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Statuses</option>
          {["active", "expired", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button onClick={openCreate} className="ml-auto"><Plus size={16} /> Add License</Button>
      </div>

      {loading ? <LoadingSpinner /> : licenses.length === 0 ? (
        <EmptyState title="No licenses yet" description="Add your first software license to start tracking seats and renewals." icon={<Key size={32} />} />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Software", "Vendor", "Type", "Seats", "Assigned To", "Annual Cost", "Expiry", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {licenses.map((lic) => {
                  const { assignedIds } = decodeAssignments(lic.notes);
                  const actualUsed = assignedIds.length;
                  const usage = lic.totalSeats > 0 ? Math.round((actualUsed / lic.totalSeats) * 100) : 0;
                  const assignedNames = assignedIds
                    .map((id) => empById[id])
                    .filter(Boolean)
                    .map((e) => `${e.firstName} ${e.lastName}`);
                  return (
                    <tr key={lic.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F] align-top">
                      <td className="px-4 py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{lic.softwareName}</td>
                      <td className="px-4 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{lic.vendor || "—"}</td>
                      <td className="px-4 py-3"><Badge variant="purple">{lic.licenseType}</Badge></td>
                      <td className="px-4 py-3 text-[#4C4566] dark:text-[#B8AEDD]">
                        <div className="flex items-center gap-2">
                          <span>{actualUsed} / {lic.totalSeats}</span>
                          <div className="w-12 h-1.5 bg-[#EDE9FE] dark:bg-[#2D1F5E] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${usage > 90 ? "bg-red-500" : usage > 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(usage, 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        {assignedNames.length === 0 ? (
                          <span className="text-xs text-[#9B93B8]">Unassigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {assignedNames.slice(0, 3).map((n) => (
                              <span key={n} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6] dark:text-[#C4B5FD]">{n}</span>
                            ))}
                            {assignedNames.length > 3 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-[#F4F1FC] dark:bg-[#1A1535] text-[#9B93B8]">+{assignedNames.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-serif">{lic.annualCost ? formatCurrency(lic.annualCost) : "—"}</td>
                      <td className="px-4 py-3 text-xs text-[#9B93B8]">{lic.expiryDate ? formatDate(lic.expiryDate) : "Perpetual"}</td>
                      <td className="px-4 py-3"><Badge variant={lic.status === "active" ? "success" : lic.status === "expired" ? "danger" : "default"}>{lic.status}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(lic)} className="p-1.5 rounded-[6px] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] text-[#9B93B8] hover:text-[#5B21B6]"><Edit size={14} /></button>
                          <button onClick={() => { setDeleteId(lic.id); setShowDelete(true); }} className="p-1.5 rounded-[6px] hover:bg-red-50 dark:hover:bg-red-900/20 text-[#9B93B8] hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit License" : "Add License"} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput label="Software Name" value={form.softwareName} onChange={(v) => setField("softwareName", v)} required placeholder="e.g. Adobe Creative Cloud" />
          <FormInput label="Vendor" value={form.vendor} onChange={(v) => setField("vendor", v)} placeholder="e.g. Adobe Inc." />
          <FormSelect label="License Type" value={form.licenseType} onChange={(v) => setField("licenseType", v)} options={LICENSE_TYPES} />
          <FormInput label="License Key" value={form.licenseKey} onChange={(v) => setField("licenseKey", v)} placeholder="Optional — for your records" />
          <FormInput label="Total Seats" value={form.totalSeats} onChange={(v) => setField("totalSeats", v)} type="number" required />
          <FormInput label="Purchase Date" value={form.purchaseDate} onChange={(v) => setField("purchaseDate", v)} type="date" required />
          <FormInput label="Expiry Date" value={form.expiryDate} onChange={(v) => setField("expiryDate", v)} type="date" />
          <FormInput label="Annual Cost" value={form.annualCost} onChange={(v) => setField("annualCost", v)} type="number" />
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-[#4C4566] dark:text-[#B8AEDD] mb-1">
            Assign to Employees ({form.assignedIds.length} / {form.totalSeats || 0})
          </label>
          <div className="rounded-[10px] border border-[#E8E4F3] dark:border-[#2E2850] bg-white dark:bg-[#0E0B1F]">
            <div className="p-2 border-b border-[#E8E4F3] dark:border-[#2E2850]">
              <input
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                placeholder="Search employees..."
                className="w-full px-3 py-1.5 rounded-[8px] text-xs bg-[#F8F7FF] dark:bg-[#16122E] border border-transparent focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30 text-[#1E1B2E] dark:text-[#EDE9FE]"
              />
            </div>
            <div className="max-h-[180px] overflow-y-auto p-2 space-y-1">
              {filteredEmployees.length === 0 ? (
                <p className="text-xs text-[#9B93B8] text-center py-3">No employees match</p>
              ) : filteredEmployees.map((e) => {
                const checked = form.assignedIds.includes(e.id);
                return (
                  <label key={e.id} className="flex items-center gap-2 px-2 py-1.5 rounded-[6px] hover:bg-[#F8F7FF] dark:hover:bg-[#16122E] cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={() => toggleAssignee(e.id)} className="accent-[#5B21B6]" />
                    <span className="text-xs text-[#1E1B2E] dark:text-[#EDE9FE] flex-1">
                      <span className="font-mono text-[10px] text-[#9B93B8] mr-2">{e.employeeCode}</span>
                      {e.firstName} {e.lastName}
                      <span className="text-[#9B93B8]"> — {e.position}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <p className="text-[10px] text-[#9B93B8] mt-1">Used seats auto-updates based on assignments.</p>
        </div>

        <div className="mt-4">
          <FormTextarea label="Notes" value={form.notes} onChange={(v) => setField("notes", v)} />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingId ? "Save" : "Add License"}</Button>
        </div>
      </Modal>

      <ConfirmDialog open={showDelete} onClose={() => { setShowDelete(false); setDeleteId(null); }} onConfirm={handleDelete}
        title="Remove License" message="Are you sure you want to remove this license record?" confirmLabel="Remove" loading={saving} />
    </PageWrapper>
  );
}
