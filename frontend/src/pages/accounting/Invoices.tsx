import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, Toast } from "../../components/ui/Modal";
import { DonutChartWidget } from "../../components/charts/Charts";
import { FileText, Plus, DollarSign, Clock, AlertTriangle, CheckCircle, Eye, CreditCard } from "lucide-react";
import { formatCurrency, formatDate, statusColor } from "../../utils/formatters";
import api from "../../api/client";
import type { Invoice } from "../../types";

const emptyLine = { description: "", quantity: "1", unitPrice: "", taxRate: "0" };
const emptyForm = { invoiceNumber: "", type: "sales", clientName: "", clientEmail: "", issueDate: "", dueDate: "", notes: "" };

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [lineItems, setLineItems] = useState([{ ...emptyLine }]);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paymentDate: "", paymentMethod: "bank_transfer", reference: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get(`/accounting/invoices?${params}`);
      setInvoices(res.data.data || []);
    } catch { setInvoices([]); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const openCreate = () => {
    setForm({ ...emptyForm, invoiceNumber: `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}` });
    setLineItems([{ ...emptyLine }]);
    setShowForm(true);
  };

  const openDetail = async (id: string) => {
    try {
      const res = await api.get(`/accounting/invoices/${id}`);
      setSelected(res.data.data);
      setShowDetail(true);
    } catch { setToast({ message: "Failed to load invoice", type: "error" }); }
  };

  const addLine = () => setLineItems((prev) => [...prev, { ...emptyLine }]);
  const removeLine = (i: number) => setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, key: string, val: string) => setLineItems((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));

  const subtotal = lineItems.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0);
  const taxTotal = lineItems.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0) * Number(l.taxRate || 0) / 100, 0);

  const handleSave = async () => {
    if (!form.invoiceNumber || !form.clientName || !form.issueDate || !form.dueDate || lineItems.length === 0) {
      setToast({ message: "Fill in all required fields and add at least one line item", type: "error" }); return;
    }
    if (lineItems.some((l) => !l.description || !l.unitPrice)) {
      setToast({ message: "Each line item needs a description and price", type: "error" }); return;
    }
    setSaving(true);
    try {
      await api.post("/accounting/invoices", {
        ...form,
        lineItems: lineItems.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxRate: Number(l.taxRate) })),
      });
      setToast({ message: "Invoice created", type: "success" });
      setShowForm(false); fetchData();
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to create", type: "error" });
    } finally { setSaving(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/accounting/invoices/${id}/status`, { status });
      setToast({ message: `Invoice ${status}`, type: "success" });
      setShowDetail(false); fetchData();
    } catch { setToast({ message: "Failed to update", type: "error" }); }
  };

  const recordPayment = async () => {
    if (!selected || !paymentForm.amount || !paymentForm.paymentDate) {
      setToast({ message: "Amount and date required", type: "error" }); return;
    }
    setSaving(true);
    try {
      await api.post("/accounting/payments", { invoiceId: selected.id, amount: Number(paymentForm.amount), paymentDate: paymentForm.paymentDate, paymentMethod: paymentForm.paymentMethod, reference: paymentForm.reference });
      setToast({ message: "Payment recorded", type: "success" });
      setShowPayment(false); setShowDetail(false); fetchData();
    } catch { setToast({ message: "Failed to record payment", type: "error" }); }
    finally { setSaving(false); }
  };

  const totalAmount = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const overdueCount = invoices.filter((i) => i.status === "overdue" || (i.status === "sent" && new Date(i.dueDate) < new Date())).length;
  const statusDonut = Object.entries(invoices.reduce<Record<string, number>>((acc, inv) => { acc[inv.status] = (acc[inv.status] || 0) + 1; return acc; }, {})).map(([name, value]) => ({ name, value }));

  return (
    <PageWrapper title="Invoices" subtitle="Accounting — Sales & Purchase invoices">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Invoiced" value={formatCurrency(totalAmount)} icon={<FileText size={20} />} />
        <StatCard title="Total Paid" value={formatCurrency(totalPaid)} icon={<CheckCircle size={20} />} />
        <StatCard title="Outstanding" value={formatCurrency(totalAmount - totalPaid)} icon={<Clock size={20} />} />
        <StatCard title="Overdue" value={String(overdueCount)} icon={<AlertTriangle size={20} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Statuses</option>
          {["draft", "sent", "paid", "partially_paid", "overdue", "cancelled"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <Button onClick={openCreate} className="ml-auto"><Plus size={16} /> New Invoice</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {loading ? <LoadingSpinner /> : invoices.length === 0 ? <EmptyState title="No invoices" icon={<FileText size={32} />} /> : (
            <Card><CardBody className="overflow-x-auto p-0">
              <table className="w-full text-sm"><thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                {["Invoice #", "Client", "Type", "Date", "Total", "Paid", "Status", ""].map((h) => <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>)}
              </tr></thead><tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]">
                    <td className="px-5 py-3 font-mono text-xs text-[#5B21B6]">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3 text-[#1E1B2E] dark:text-[#EDE9FE]">{inv.clientName}</td>
                    <td className="px-5 py-3"><Badge variant={inv.type === "sales" ? "success" : "info"}>{inv.type}</Badge></td>
                    <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{formatDate(inv.issueDate)}</td>
                    <td className="px-5 py-3 font-serif font-semibold">{formatCurrency(inv.totalAmount)}</td>
                    <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{formatCurrency(inv.paidAmount)}</td>
                    <td className="px-5 py-3"><Badge className={statusColor(inv.status)}>{inv.status.replace("_", " ")}</Badge></td>
                    <td className="px-5 py-3">
                      <button onClick={() => openDetail(inv.id)} className="p-1.5 rounded-[6px] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] text-[#9B93B8] hover:text-[#5B21B6]"><Eye size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody></table>
            </CardBody></Card>
          )}
        </div>
        <Card><CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">By Status</h3></CardHeader>
          <CardBody>{statusDonut.length > 0 ? <DonutChartWidget data={statusDonut} height={220} innerRadius={50} outerRadius={75} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}</CardBody>
        </Card>
      </div>

      {/* Create Invoice Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create Invoice" size="xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <FormInput label="Invoice #" value={form.invoiceNumber} onChange={(v) => setField("invoiceNumber", v)} required />
          <FormSelect label="Type" value={form.type} onChange={(v) => setField("type", v)} options={[{ value: "sales", label: "Sales" }, { value: "purchase", label: "Purchase" }]} />
          <FormInput label="Client Name" value={form.clientName} onChange={(v) => setField("clientName", v)} required />
          <FormInput label="Client Email" value={form.clientEmail} onChange={(v) => setField("clientEmail", v)} type="email" />
          <FormInput label="Issue Date" value={form.issueDate} onChange={(v) => setField("issueDate", v)} type="date" required />
          <FormInput label="Due Date" value={form.dueDate} onChange={(v) => setField("dueDate", v)} type="date" required />
        </div>
        <h4 className="text-xs font-semibold text-[#4C4566] dark:text-[#B8AEDD] mb-3">Line Items</h4>
        {lineItems.map((line, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-end">
            <div className="col-span-5"><FormInput label={i === 0 ? "Description" : ""} value={line.description} onChange={(v) => updateLine(i, "description", v)} /></div>
            <div className="col-span-2"><FormInput label={i === 0 ? "Qty" : ""} value={line.quantity} onChange={(v) => updateLine(i, "quantity", v)} type="number" /></div>
            <div className="col-span-2"><FormInput label={i === 0 ? "Unit Price" : ""} value={line.unitPrice} onChange={(v) => updateLine(i, "unitPrice", v)} type="number" /></div>
            <div className="col-span-2"><FormInput label={i === 0 ? "Tax %" : ""} value={line.taxRate} onChange={(v) => updateLine(i, "taxRate", v)} type="number" /></div>
            <div className="col-span-1 pb-1">{lineItems.length > 1 && <Button variant="ghost" className="text-red-500 px-2" onClick={() => removeLine(i)}>×</Button>}</div>
          </div>
        ))}
        <Button variant="ghost" onClick={addLine} className="text-xs mb-4"><Plus size={12} /> Add Line</Button>
        <div className="text-right space-y-1 mb-4">
          <p className="text-xs text-[#9B93B8]">Subtotal: {formatCurrency(subtotal)}</p>
          <p className="text-xs text-[#9B93B8]">Tax: {formatCurrency(taxTotal)}</p>
          <p className="text-sm font-bold text-[#1E1B2E] dark:text-[#EDE9FE]">Total: {formatCurrency(subtotal + taxTotal)}</p>
        </div>
        <FormTextarea label="Notes" value={form.notes} onChange={(v) => setField("notes", v)} />
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Create Invoice</Button>
        </div>
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal open={showDetail} onClose={() => { setShowDetail(false); setSelected(null); }} title="Invoice Details" size="lg">
        {selected && (
          <div>
            <div className="flex justify-between mb-4">
              <div>
                <p className="text-lg font-mono font-bold text-[#5B21B6]">{selected.invoiceNumber}</p>
                <p className="text-sm text-[#4C4566] dark:text-[#B8AEDD]">{selected.clientName}</p>
              </div>
              <Badge className={statusColor(selected.status)}>{selected.status.replace("_", " ")}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div><p className="text-[10px] text-[#9B93B8] uppercase">Issue Date</p><p className="text-sm">{formatDate(selected.issueDate)}</p></div>
              <div><p className="text-[10px] text-[#9B93B8] uppercase">Due Date</p><p className="text-sm">{formatDate(selected.dueDate)}</p></div>
              <div><p className="text-[10px] text-[#9B93B8] uppercase">Type</p><p className="text-sm capitalize">{selected.type}</p></div>
            </div>
            {selected.lineItems && selected.lineItems.length > 0 && (
              <table className="w-full text-sm mb-4">
                <thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Description", "Qty", "Price", "Tax", "Amount"].map((h) => <th key={h} className="text-left py-2 text-xs text-[#9B93B8]">{h}</th>)}
                </tr></thead>
                <tbody>{selected.lineItems.map((li) => (
                  <tr key={li.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                    <td className="py-2">{li.description}</td><td className="py-2">{li.quantity}</td>
                    <td className="py-2">{formatCurrency(li.unitPrice)}</td><td className="py-2">{li.taxRate}%</td>
                    <td className="py-2 font-semibold">{formatCurrency(li.amount)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            <div className="text-right space-y-1 mb-4">
              <p className="text-xs text-[#9B93B8]">Subtotal: {formatCurrency(selected.subtotal)}</p>
              <p className="text-xs text-[#9B93B8]">Tax: {formatCurrency(selected.taxAmount)}</p>
              <p className="text-sm font-bold">Total: {formatCurrency(selected.totalAmount)}</p>
              <p className="text-sm text-emerald-600">Paid: {formatCurrency(selected.paidAmount)}</p>
              {selected.totalAmount - selected.paidAmount > 0 && <p className="text-sm text-red-600">Due: {formatCurrency(selected.totalAmount - selected.paidAmount)}</p>}
            </div>
            <div className="flex gap-2 pt-4 border-t border-[#E8E4F3] dark:border-[#2E2850]">
              {selected.status === "draft" && <Button variant="secondary" onClick={() => updateStatus(selected.id, "sent")}>Mark as Sent</Button>}
              {selected.status !== "paid" && selected.status !== "cancelled" && (
                <Button onClick={() => { setPaymentForm({ amount: String(selected.totalAmount - selected.paidAmount), paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: "bank_transfer", reference: "" }); setShowPayment(true); }}>
                  <CreditCard size={14} /> Record Payment
                </Button>
              )}
              {selected.status !== "cancelled" && selected.status !== "paid" && <Button variant="ghost" onClick={() => updateStatus(selected.id, "cancelled")}>Cancel</Button>}
            </div>
          </div>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal open={showPayment} onClose={() => setShowPayment(false)} title="Record Payment" size="sm">
        <div className="space-y-4">
          <FormInput label="Amount" value={paymentForm.amount} onChange={(v) => setPaymentForm((p) => ({ ...p, amount: v }))} type="number" required />
          <FormInput label="Date" value={paymentForm.paymentDate} onChange={(v) => setPaymentForm((p) => ({ ...p, paymentDate: v }))} type="date" required />
          <FormSelect label="Method" value={paymentForm.paymentMethod} onChange={(v) => setPaymentForm((p) => ({ ...p, paymentMethod: v }))} options={[
            { value: "bank_transfer", label: "Bank Transfer" }, { value: "credit_card", label: "Credit Card" },
            { value: "cash", label: "Cash" }, { value: "check", label: "Check" }, { value: "online", label: "Online" },
          ]} />
          <FormInput label="Reference" value={paymentForm.reference} onChange={(v) => setPaymentForm((p) => ({ ...p, reference: v }))} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowPayment(false)}>Cancel</Button>
          <Button onClick={recordPayment} loading={saving}>Record Payment</Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
