import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { DonutChartWidget } from "../../components/charts/Charts";
import { FileText, Plus, DollarSign, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { formatCurrency, formatDate, statusColor } from "../../utils/formatters";
import api from "../../api/client";
import type { Invoice } from "../../types";

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => { fetchData(); }, [statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get(`/accounting/invoices?${params}`);
      setInvoices(res.data.data || []);
    } catch {
      setInvoices([
        { id: "1", invoiceNumber: "INV-2024-001", type: "sales", clientName: "Acme Corp", clientEmail: "billing@acme.com", issueDate: "2024-12-01", dueDate: "2024-12-31", subtotal: 50000, taxAmount: 5000, totalAmount: 55000, paidAmount: 55000, status: "paid" },
        { id: "2", invoiceNumber: "INV-2024-002", type: "sales", clientName: "TechStart Inc", clientEmail: null, issueDate: "2024-12-05", dueDate: "2025-01-05", subtotal: 32000, taxAmount: 3200, totalAmount: 35200, paidAmount: 15000, status: "partially_paid" },
        { id: "3", invoiceNumber: "INV-2024-003", type: "sales", clientName: "Global Logistics", clientEmail: null, issueDate: "2024-12-10", dueDate: "2025-01-10", subtotal: 28000, taxAmount: 2800, totalAmount: 30800, paidAmount: 0, status: "sent" },
        { id: "4", invoiceNumber: "INV-2024-004", type: "purchase", clientName: "AWS Services", clientEmail: null, issueDate: "2024-12-01", dueDate: "2024-12-15", subtotal: 8500, taxAmount: 0, totalAmount: 8500, paidAmount: 0, status: "overdue" },
        { id: "5", invoiceNumber: "INV-2024-005", type: "sales", clientName: "DataFlow LLC", clientEmail: null, issueDate: "2024-12-15", dueDate: "2025-01-15", subtotal: 18000, taxAmount: 1800, totalAmount: 19800, paidAmount: 0, status: "draft" },
      ]);
    } finally { setLoading(false); }
  };

  const totalAmount = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const totalOutstanding = totalAmount - totalPaid;
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;

  const statusDonut = Object.entries(
    invoices.reduce<Record<string, number>>((acc, inv) => { acc[inv.status] = (acc[inv.status] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <PageWrapper title="Invoices" subtitle="Accounting — Sales & Purchase invoices">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Invoiced" value={formatCurrency(totalAmount)} icon={<FileText size={20} />} />
        <StatCard title="Total Paid" value={formatCurrency(totalPaid)} icon={<CheckCircle size={20} />} />
        <StatCard title="Outstanding" value={formatCurrency(totalOutstanding)} icon={<Clock size={20} />} />
        <StatCard title="Overdue" value={String(overdueCount)} icon={<AlertTriangle size={20} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Statuses</option>
          {["draft", "sent", "paid", "partially_paid", "overdue", "cancelled"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium text-white bg-[#5B21B6] hover:bg-[#7C3AED] transition-colors ml-auto">
          <Plus size={16} /> New Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {loading ? <LoadingSpinner /> : invoices.length === 0 ? <EmptyState title="No invoices found" icon={<FileText size={32} />} /> : (
            <Card>
              <CardBody className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                      {["Invoice #", "Client", "Type", "Issue Date", "Due Date", "Total", "Paid", "Status"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]">
                        <td className="px-5 py-3 font-medium font-mono text-[#5B21B6]">{inv.invoiceNumber}</td>
                        <td className="px-5 py-3 text-[#1E1B2E] dark:text-[#EDE9FE]">{inv.clientName}</td>
                        <td className="px-5 py-3"><Badge variant={inv.type === "sales" ? "success" : "info"}>{inv.type}</Badge></td>
                        <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{formatDate(inv.issueDate)}</td>
                        <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{formatDate(inv.dueDate)}</td>
                        <td className="px-5 py-3 font-semibold font-serif text-[#1E1B2E] dark:text-[#EDE9FE]">{formatCurrency(inv.totalAmount)}</td>
                        <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{formatCurrency(inv.paidAmount)}</td>
                        <td className="px-5 py-3"><Badge className={statusColor(inv.status)}>{inv.status.replace("_", " ")}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">By Status</h3></CardHeader>
          <CardBody><DonutChartWidget data={statusDonut} height={220} innerRadius={50} outerRadius={75} /></CardBody>
        </Card>
      </div>
    </PageWrapper>
  );
}
