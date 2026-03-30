import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, LoadingSpinner, Badge } from "../../components/ui/Card";
import { Button, Toast } from "../../components/ui/Modal";
import { BarChartWidget, DonutChartWidget } from "../../components/charts/Charts";
import { DollarSign, TrendingUp, PieChart, AlertTriangle, FileBarChart, Plus } from "lucide-react";
import { formatCurrency, formatPercent } from "../../utils/formatters";
import api from "../../api/client";

interface VarianceItem {
  category: string; categoryType: string; allocated: number; spent: number;
  variance: number; variancePercent: number; status: string;
}

export default function AdminFinance() {
  const [budgetSummary, setBudgetSummary] = useState<{ totalAllocated: number; totalSpent: number; totalRemaining: number; utilizationRate: number; byCategory: Array<{ category: string; allocated: number; spent: number; utilization: number }> } | null>(null);
  const [variance, setVariance] = useState<{ categories: VarianceItem[]; summary: { overBudget: number; warning: number; onTrack: number } } | null>(null);
  const [costCenters, setCostCenters] = useState<Array<{ id: string; name: string; code: string; budgetLimit: number | null; department: { name: string } | null; _count: { transactions: number } }>>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [budgetRes, varianceRes, ccRes] = await Promise.allSettled([
        api.get("/finance/budgets/summary"),
        api.get("/finance/variance-analysis"),
        api.get("/finance/cost-centers"),
      ]);
      if (budgetRes.status === "fulfilled") setBudgetSummary(budgetRes.value.data.data);
      if (varianceRes.status === "fulfilled") setVariance(varianceRes.value.data.data);
      if (ccRes.status === "fulfilled") setCostCenters(ccRes.value.data.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generateReport = async (type: string) => {
    try {
      const now = new Date();
      const startOfYear = `${now.getFullYear()}-01-01`;
      const today = now.toISOString().slice(0, 10);
      await api.post("/finance/reports/generate", {
        name: `${type} Report — ${now.getFullYear()}`,
        type,
        periodStart: startOfYear,
        periodEnd: today,
      });
      setToast({ message: `${type} report generated`, type: "success" });
    } catch { setToast({ message: "Failed to generate report", type: "error" }); }
  };

  if (loading) return <PageWrapper title="Finance Administration" subtitle="Admin View"><LoadingSpinner /></PageWrapper>;

  const b = budgetSummary;
  const statusColors: Record<string, string> = { over_budget: "danger", warning: "warning", on_track: "success", under_budget: "info" };

  return (
    <PageWrapper title="Finance Administration" subtitle="Admin View — Budget oversight, variance analysis, reports">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Budget" value={formatCurrency(b?.totalAllocated || 0)} icon={<DollarSign size={20} />} />
        <StatCard title="Total Spent" value={formatCurrency(b?.totalSpent || 0)} icon={<TrendingUp size={20} />} />
        <StatCard title="Utilization" value={formatPercent(b?.utilizationRate || 0)} icon={<PieChart size={20} />} />
        <StatCard title="Over Budget" value={String(variance?.summary?.overBudget || 0)} icon={<AlertTriangle size={20} />} />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-6">
        <Button variant="secondary" onClick={() => generateReport("income_statement")}><FileBarChart size={14} /> Income Statement</Button>
        <Button variant="secondary" onClick={() => generateReport("balance_sheet")}><FileBarChart size={14} /> Balance Sheet</Button>
        <Button variant="secondary" onClick={() => generateReport("cash_flow")}><FileBarChart size={14} /> Cash Flow</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Variance Analysis */}
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Variance Analysis</h3></CardHeader>
          <CardBody className="space-y-2">
            {variance?.categories?.map((v) => (
              <div key={v.category} className="flex items-center justify-between py-2 border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                <div>
                  <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{v.category}</p>
                  <p className="text-[10px] text-[#9B93B8]">{formatCurrency(v.spent)} of {formatCurrency(v.allocated)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${v.variance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {v.variance >= 0 ? "+" : ""}{formatCurrency(v.variance)}
                  </span>
                  <Badge variant={(statusColors[v.status] || "default") as "success" | "warning" | "danger" | "info" | "default"}>
                    {v.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            )) || <p className="text-xs text-[#9B93B8] text-center py-4">No variance data</p>}
          </CardBody>
        </Card>

        {/* Budget Chart */}
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Budget Allocation</h3></CardHeader>
          <CardBody>
            {b?.byCategory && b.byCategory.length > 0 ? (
              <DonutChartWidget data={b.byCategory.map((c) => ({ name: c.category, value: c.allocated }))} height={280} />
            ) : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
          </CardBody>
        </Card>
      </div>

      {/* Cost Centers */}
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Cost Centers</h3></CardHeader>
        <CardBody className="overflow-x-auto">
          {costCenters.length === 0 ? <p className="text-xs text-[#9B93B8] text-center py-4">No cost centers</p> : (
            <table className="w-full text-sm"><thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
              {["Name", "Code", "Department", "Budget Limit", "Transactions"].map((h) => <th key={h} className="text-left px-4 py-2 text-xs font-medium text-[#9B93B8]">{h}</th>)}
            </tr></thead><tbody>
              {costCenters.map((cc) => (
                <tr key={cc.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                  <td className="px-4 py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{cc.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#5B21B6]">{cc.code}</td>
                  <td className="px-4 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{cc.department?.name || "—"}</td>
                  <td className="px-4 py-3">{cc.budgetLimit ? formatCurrency(cc.budgetLimit) : "—"}</td>
                  <td className="px-4 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{cc._count?.transactions || 0}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </CardBody>
      </Card>
    </PageWrapper>
  );
}
