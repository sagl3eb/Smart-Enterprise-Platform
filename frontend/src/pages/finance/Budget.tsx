import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner } from "../../components/ui/Card";
import { BarChartWidget, DonutChartWidget } from "../../components/charts/Charts";
import { DollarSign, TrendingUp, PieChart, AlertTriangle } from "lucide-react";
import { formatCurrency, formatPercent } from "../../utils/formatters";
import api from "../../api/client";

interface BudgetSummary {
  fiscalYear: number;
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  utilizationRate: number;
  categoryCount: number;
  byCategory: Array<{ category: string; categoryType: string; allocated: number; spent: number; remaining: number; utilization: number }>;
}

export default function Budget() {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/finance/budgets/summary");
      setSummary(res.data.data);
    } catch {
      setSummary({
        fiscalYear: 2025, totalAllocated: 5000000, totalSpent: 3200000, totalRemaining: 1800000, utilizationRate: 64, categoryCount: 8,
        byCategory: [
          { category: "Personnel", categoryType: "expense", allocated: 2000000, spent: 1450000, remaining: 550000, utilization: 72.5 },
          { category: "Technology", categoryType: "expense", allocated: 800000, spent: 520000, remaining: 280000, utilization: 65 },
          { category: "Marketing", categoryType: "expense", allocated: 600000, spent: 410000, remaining: 190000, utilization: 68.3 },
          { category: "Operations", categoryType: "expense", allocated: 500000, spent: 380000, remaining: 120000, utilization: 76 },
          { category: "Training", categoryType: "expense", allocated: 300000, spent: 180000, remaining: 120000, utilization: 60 },
          { category: "Infrastructure", categoryType: "capital", allocated: 500000, spent: 160000, remaining: 340000, utilization: 32 },
          { category: "Revenue Target", categoryType: "revenue", allocated: 8000000, spent: 5600000, remaining: 2400000, utilization: 70 },
          { category: "Contingency", categoryType: "expense", allocated: 300000, spent: 100000, remaining: 200000, utilization: 33.3 },
        ],
      });
    } finally { setLoading(false); }
  };

  if (loading || !summary) return <PageWrapper title="Budget Overview" subtitle="Finance"><LoadingSpinner /></PageWrapper>;

  const expenseCategories = summary.byCategory.filter((c) => c.categoryType === "expense");
  const donutData = expenseCategories.map((c) => ({ name: c.category, value: c.spent }));
  const barData = expenseCategories.map((c) => ({ name: c.category, Allocated: c.allocated / 1000, Spent: c.spent / 1000 }));

  return (
    <PageWrapper title="Budget Overview" subtitle={`Finance — FY ${summary.fiscalYear}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Allocated" value={formatCurrency(summary.totalAllocated)} icon={<DollarSign size={20} />} />
        <StatCard title="Total Spent" value={formatCurrency(summary.totalSpent)} change={5.2} subtitle="vs last quarter" icon={<TrendingUp size={20} />} />
        <StatCard title="Remaining" value={formatCurrency(summary.totalRemaining)} icon={<PieChart size={20} />} />
        <StatCard title="Utilization" value={formatPercent(summary.utilizationRate)} change={summary.utilizationRate > 80 ? 8 : -3} icon={<AlertTriangle size={20} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Allocated vs Spent (K)</h3></CardHeader>
          <CardBody><BarChartWidget data={barData} bars={[{ key: "Allocated", color: "#5B21B6" }, { key: "Spent", color: "#D97706" }]} xKey="name" height={300} /></CardBody>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Spending by Category</h3></CardHeader>
          <CardBody><DonutChartWidget data={donutData} height={300} /></CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Category Details</h3></CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                <th className="text-left py-2 text-xs font-medium text-[#9B93B8]">Category</th>
                <th className="text-left py-2 text-xs font-medium text-[#9B93B8]">Type</th>
                <th className="text-right py-2 text-xs font-medium text-[#9B93B8]">Allocated</th>
                <th className="text-right py-2 text-xs font-medium text-[#9B93B8]">Spent</th>
                <th className="text-right py-2 text-xs font-medium text-[#9B93B8]">Remaining</th>
                <th className="text-right py-2 text-xs font-medium text-[#9B93B8]">Utilization</th>
                <th className="text-center py-2 text-xs font-medium text-[#9B93B8]">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.byCategory.map((cat) => (
                <tr key={cat.category} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                  <td className="py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{cat.category}</td>
                  <td className="py-3"><Badge variant="purple">{cat.categoryType}</Badge></td>
                  <td className="py-3 text-right text-[#4C4566] dark:text-[#B8AEDD]">{formatCurrency(cat.allocated)}</td>
                  <td className="py-3 text-right text-[#4C4566] dark:text-[#B8AEDD]">{formatCurrency(cat.spent)}</td>
                  <td className="py-3 text-right text-[#4C4566] dark:text-[#B8AEDD]">{formatCurrency(cat.remaining)}</td>
                  <td className="py-3 text-right font-medium">{formatPercent(cat.utilization)}</td>
                  <td className="py-3 text-center">
                    <Badge variant={cat.utilization > 90 ? "danger" : cat.utilization > 70 ? "warning" : "success"}>
                      {cat.utilization > 90 ? "Over" : cat.utilization > 70 ? "Warning" : "On Track"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </PageWrapper>
  );
}
