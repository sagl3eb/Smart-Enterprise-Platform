import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, LoadingSpinner, Badge } from "../../components/ui/Card";
import { Toast } from "../../components/ui/Modal";
import { DonutChartWidget } from "../../components/charts/Charts";
import { BookOpen, FileText, Scale, CreditCard, CheckCircle, DollarSign } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";
import api from "../../api/client";

export default function AdminAccounting() {
  const [trialBalance, setTrialBalance] = useState<{ rows: Array<{ accountCode: string; name: string; type: string; debit: number; credit: number }>; totalDebits: number; totalCredits: number; isBalanced: boolean } | null>(null);
  const [invoiceSummary, setInvoiceSummary] = useState<{ totalAmount: number; totalPaid: number; outstanding: number; count: number; overdueCount: number; byStatus: Array<{ status: string; count: number; total: number }> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tbRes, invRes] = await Promise.allSettled([
        api.get("/accounting/trial-balance"),
        api.get("/accounting/invoices/summary"),
      ]);
      if (tbRes.status === "fulfilled") setTrialBalance(tbRes.value.data.data);
      if (invRes.status === "fulfilled") setInvoiceSummary(invRes.value.data.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <PageWrapper title="Accounting Administration" subtitle="Admin View"><LoadingSpinner /></PageWrapper>;

  const tb = trialBalance;
  const inv = invoiceSummary;

  return (
    <PageWrapper title="Accounting Administration" subtitle="Admin View — Trial balance, invoice oversight, financial health">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Invoiced" value={formatCurrency(inv?.totalAmount || 0)} icon={<FileText size={20} />} />
        <StatCard title="Total Paid" value={formatCurrency(inv?.totalPaid || 0)} icon={<CreditCard size={20} />} />
        <StatCard title="Outstanding" value={formatCurrency(inv?.outstanding || 0)} icon={<DollarSign size={20} />} />
        <StatCard title="Trial Balance" value={tb?.isBalanced ? "Balanced" : "Unbalanced"} icon={<Scale size={20} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Trial Balance */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-[#5B21B6]" />
              <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Trial Balance</h3>
            </div>
            {tb && <Badge variant={tb.isBalanced ? "success" : "danger"}>{tb.isBalanced ? "Balanced" : "Unbalanced"}</Badge>}
          </CardHeader>
          <CardBody className="overflow-x-auto">
            {tb?.rows && tb.rows.length > 0 ? (
              <>
                <table className="w-full text-sm"><thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Code", "Account", "Type", "Debit", "Credit"].map((h) => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-[#9B93B8]">{h}</th>)}
                </tr></thead><tbody>
                  {tb.rows.filter((r) => r.debit > 0 || r.credit > 0).map((r) => (
                    <tr key={r.accountCode} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-[#5B21B6]">{r.accountCode}</td>
                      <td className="px-3 py-2 text-[#1E1B2E] dark:text-[#EDE9FE]">{r.name}</td>
                      <td className="px-3 py-2 text-xs text-[#9B93B8]">{r.type}</td>
                      <td className="px-3 py-2 text-right">{r.debit > 0 ? formatCurrency(r.debit) : ""}</td>
                      <td className="px-3 py-2 text-right">{r.credit > 0 ? formatCurrency(r.credit) : ""}</td>
                    </tr>
                  ))}
                  <tr className="font-bold border-t-2 border-[#5B21B6]">
                    <td colSpan={3} className="px-3 py-2 text-right text-[#1E1B2E] dark:text-[#EDE9FE]">Totals</td>
                    <td className="px-3 py-2 text-right text-[#1E1B2E] dark:text-[#EDE9FE]">{formatCurrency(tb.totalDebits)}</td>
                    <td className="px-3 py-2 text-right text-[#1E1B2E] dark:text-[#EDE9FE]">{formatCurrency(tb.totalCredits)}</td>
                  </tr>
                </tbody></table>
              </>
            ) : <p className="text-xs text-[#9B93B8] text-center py-8">No accounts with balances</p>}
          </CardBody>
        </Card>

        {/* Invoice Summary */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Invoice Overview</h3>
          </CardHeader>
          <CardBody>
            {inv?.byStatus && inv.byStatus.length > 0 ? (
              <>
                <DonutChartWidget data={inv.byStatus.map((s) => ({ name: s.status.replace("_", " "), value: s.count }))} height={200} innerRadius={50} outerRadius={75} />
                <div className="mt-4 space-y-2">
                  {inv.byStatus.map((s) => (
                    <div key={s.status} className="flex items-center justify-between py-1.5 border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                      <span className="text-xs text-[#4C4566] dark:text-[#B8AEDD] capitalize">{s.status.replace("_", " ")}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#9B93B8]">{s.count} inv</span>
                        <span className="text-xs font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{formatCurrency(s.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-xs text-[#9B93B8] text-center py-8">No invoice data</p>}
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  );
}
