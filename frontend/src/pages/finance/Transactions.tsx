import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, ConfirmDialog, Toast } from "../../components/ui/Modal";
import { Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, Trash2, Edit } from "lucide-react";
import { formatCurrency, formatDate, statusColor } from "../../utils/formatters";
import api from "../../api/client";
import type { Transaction, ApiMeta } from "../../types";

const emptyForm = { type: "expense", category: "", amount: "", description: "", reference: "", transactionDate: "", costCenterId: "" };

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

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
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (typeFilter) params.set("type", typeFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/finance/transactions?${params}`);
      setTransactions(res.data.data || []);
      setMeta(res.data.meta || null);
    } catch { setTransactions([]); }
    finally { setLoading(false); }
  }, [page, typeFilter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };

  const openEdit = (tx: Transaction) => {
    setForm({
      type: tx.type, category: tx.category, amount: String(tx.amount),
      description: tx.description || "", reference: tx.reference || "",
      transactionDate: tx.transactionDate.slice(0, 10), costCenterId: tx.costCenterId || "",
    });
    setEditingId(tx.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.type || !form.category || !form.amount || !form.transactionDate) {
      setToast({ message: "Please fill in type, category, amount, and date", type: "error" }); return;
    }
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editingId) {
        await api.put(`/finance/transactions/${editingId}`, payload);
        setToast({ message: "Transaction updated", type: "success" });
      } else {
        await api.post("/finance/transactions", payload);
        setToast({ message: "Transaction created", type: "success" });
      }
      setShowForm(false); fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save";
      setToast({ message: msg, type: "error" });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      await api.delete(`/finance/transactions/${deleteId}`);
      setToast({ message: "Transaction deleted", type: "success" });
      setShowDelete(false); setDeleteId(null); fetchData();
    } catch { setToast({ message: "Failed to delete", type: "error" }); }
    finally { setSaving(false); }
  };

  return (
    <PageWrapper title="Transactions" subtitle="Finance — Income & Expenses">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchData()} placeholder="Search transactions..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Types</option>
          <option value="income">Income</option><option value="expense">Expense</option><option value="transfer">Transfer</option>
        </select>
        <Button onClick={openCreate} className="ml-auto"><Plus size={16} /> Add Transaction</Button>
      </div>

      {loading ? <LoadingSpinner /> : transactions.length === 0 ? <EmptyState title="No transactions found" icon={<Filter size={32} />} /> : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Date", "Type", "Category", "Description", "Reference", "Amount", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]">
                    <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{formatDate(tx.transactionDate)}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        {tx.type === "income" ? <ArrowDownLeft size={14} className="text-emerald-500" /> : <ArrowUpRight size={14} className="text-red-500" />}
                        <span className="capitalize text-[#1E1B2E] dark:text-[#EDE9FE]">{tx.type}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[#1E1B2E] dark:text-[#EDE9FE]">{tx.category}</td>
                    <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD] max-w-[180px] truncate">{tx.description}</td>
                    <td className="px-5 py-3 text-xs font-mono text-[#9B93B8]">{tx.reference}</td>
                    <td className={`px-5 py-3 font-semibold font-serif ${tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </td>
                    <td className="px-5 py-3"><Badge className={statusColor(tx.status)}>{tx.status}</Badge></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(tx)} className="p-1.5 rounded-[6px] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] text-[#9B93B8] hover:text-[#5B21B6]"><Edit size={14} /></button>
                        <button onClick={() => { setDeleteId(tx.id); setShowDelete(true); }} className="p-1.5 rounded-[6px] hover:bg-red-50 dark:hover:bg-red-900/20 text-[#9B93B8] hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-[#9B93B8]">Page {meta.page} of {meta.totalPages}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>Previous</Button>
            <Button variant="ghost" onClick={() => setPage(page + 1)} disabled={page >= meta.totalPages}>Next</Button>
          </div>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Transaction" : "Add Transaction"} size="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSelect label="Type" value={form.type} onChange={(v) => setField("type", v)} required options={[
            { value: "income", label: "Income" }, { value: "expense", label: "Expense" }, { value: "transfer", label: "Transfer" },
          ]} />
          <FormInput label="Category" value={form.category} onChange={(v) => setField("category", v)} required placeholder="e.g. Personnel, Marketing" />
          <FormInput label="Amount" value={form.amount} onChange={(v) => setField("amount", v)} type="number" required />
          <FormInput label="Date" value={form.transactionDate} onChange={(v) => setField("transactionDate", v)} type="date" required />
          <FormInput label="Reference" value={form.reference} onChange={(v) => setField("reference", v)} placeholder="Invoice or ref #" />
          <FormTextarea label="Description" value={form.description} onChange={(v) => setField("description", v)} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingId ? "Save" : "Create"}</Button>
        </div>
      </Modal>

      <ConfirmDialog open={showDelete} onClose={() => { setShowDelete(false); setDeleteId(null); }} onConfirm={handleDelete}
        title="Delete Transaction" message="Are you sure you want to delete this transaction?" confirmLabel="Delete" loading={saving} />
    </PageWrapper>
  );
}
