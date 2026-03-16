import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, Toast } from "../../components/ui/Modal";
import { Plus, Search, BookOpen } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";
import api from "../../api/client";
import type { ChartOfAccount } from "../../types";

const typeColors: Record<string, "success" | "danger" | "warning" | "info" | "purple"> = { asset: "info", liability: "danger", equity: "purple", revenue: "success", expense: "warning" };
const emptyForm = { accountCode: "", name: "", type: "asset", parentId: "", description: "" };

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/accounting/accounts?${params}`);
      setAccounts(res.data.data || []);
    } catch { setAccounts([]); }
    finally { setLoading(false); }
  }, [typeFilter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.accountCode || !form.name || !form.type) { setToast({ message: "Code, name, and type required", type: "error" }); return; }
    setSaving(true);
    try {
      await api.post("/accounting/accounts", { ...form, parentId: form.parentId || undefined });
      setToast({ message: "Account created", type: "success" });
      setShowForm(false); fetchData();
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed", type: "error" });
    } finally { setSaving(false); }
  };

  const filtered = accounts.filter((a) => {
    if (search) { const q = search.toLowerCase(); return a.name.toLowerCase().includes(q) || a.accountCode.includes(q); }
    return true;
  });

  const totals = {
    assets: filtered.filter((a) => a.type === "asset").reduce((s, a) => s + a.balance, 0),
    liabilities: filtered.filter((a) => a.type === "liability").reduce((s, a) => s + a.balance, 0),
    equity: filtered.filter((a) => a.type === "equity").reduce((s, a) => s + a.balance, 0),
    revenue: filtered.filter((a) => a.type === "revenue").reduce((s, a) => s + a.balance, 0),
    expenses: filtered.filter((a) => a.type === "expense").reduce((s, a) => s + a.balance, 0),
  };

  const parentOptions = accounts.map((a) => ({ value: a.id, label: `${a.accountCode} - ${a.name}` }));

  return (
    <PageWrapper title="Chart of Accounts" subtitle="Accounting — Account structure">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {Object.entries(totals).map(([key, value]) => (
          <Card key={key}><CardBody className="py-3 px-4 text-center">
            <p className="text-[10px] font-medium text-[#9B93B8] uppercase">{key}</p>
            <p className="text-lg font-bold font-serif text-[#1E1B2E] dark:text-[#EDE9FE]">{formatCurrency(value)}</p>
          </CardBody></Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Types</option>
          {["asset", "liability", "equity", "revenue", "expense"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button onClick={() => { setForm(emptyForm); setShowForm(true); }} className="ml-auto"><Plus size={16} /> Add Account</Button>
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? <EmptyState title="No accounts" icon={<BookOpen size={32} />} /> : (
        <Card><CardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm"><thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
            {["Code", "Name", "Type", "Balance", "Status"].map((h) => <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>)}
          </tr></thead><tbody>
            {filtered.map((acc) => (
              <tr key={acc.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]">
                <td className="px-5 py-3 font-mono text-xs text-[#5B21B6]">{acc.accountCode}</td>
                <td className="px-5 py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{acc.name}</td>
                <td className="px-5 py-3"><Badge variant={typeColors[acc.type] || "default"}>{acc.type}</Badge></td>
                <td className="px-5 py-3 font-serif font-semibold">{formatCurrency(acc.balance)}</td>
                <td className="px-5 py-3"><Badge variant={acc.isActive ? "success" : "default"}>{acc.isActive ? "Active" : "Inactive"}</Badge></td>
              </tr>
            ))}
          </tbody></table>
        </CardBody></Card>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Account" size="md">
        <div className="space-y-4">
          <FormInput label="Account Code" value={form.accountCode} onChange={(v) => setField("accountCode", v)} required placeholder="e.g. 1000" />
          <FormInput label="Account Name" value={form.name} onChange={(v) => setField("name", v)} required />
          <FormSelect label="Type" value={form.type} onChange={(v) => setField("type", v)} required options={[
            { value: "asset", label: "Asset" }, { value: "liability", label: "Liability" },
            { value: "equity", label: "Equity" }, { value: "revenue", label: "Revenue" }, { value: "expense", label: "Expense" },
          ]} />
          <FormSelect label="Parent Account" value={form.parentId} onChange={(v) => setField("parentId", v)} options={parentOptions} placeholder="None (top-level)" />
          <FormTextarea label="Description" value={form.description} onChange={(v) => setField("description", v)} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Create</Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
