import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, Toast } from "../../components/ui/Modal";
import { BarChartWidget, DonutChartWidget } from "../../components/charts/Charts";
import { DollarSign, TrendingUp, PieChart, AlertTriangle, Plus, FileBarChart } from "lucide-react";
import { formatCurrency, formatPercent } from "../../utils/formatters";
import api from "../../api/client";

interface BudgetSummary {
  fiscalYear: number; totalAllocated: number; totalSpent: number; totalRemaining: number;
  utilizationRate: number; categoryCount: number;
  byCategory: Array<{ category: string; categoryType: string; allocated: number; spent: number; remaining: number; utilization: number }>;
}

const emptyBudgetForm = { categoryId: "", fiscalYear: String(new Date().getFullYear()), allocatedAmount: "", notes: "" };
const emptyCategoryForm = { name: "", code: "", type: "expense", description: "" };

export default function Budget() {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; code: string; type: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [budgetForm, setBudgetForm] = useState(emptyBudgetForm);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, catRes] = await Promise.allSettled([
        api.get("/finance/budgets/summary"),
        api.get("/finance/budget-categories"),
      ]);
      if (summaryRes.status === "fulfilled") setSummary(summaryRes.value.data.data);
      if (catRes.status === "fulfilled") setCategories(catRes.value.data.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateBudget = async () => {
    if (!budgetForm.categoryId || !budgetForm.allocatedAmount) { setToast({ message: "Category and amount required", type: "error" }); return; }
    setSaving(true);
    try {
      await api.post("/finance/budgets", { categoryId: budgetForm.categoryId, fiscalYear: Number(budgetForm.fiscalYear), allocatedAmount: Number(budgetForm.allocatedAmount), notes: budgetForm.notes });
      setToast({ message: "Budget created", type: "success" }); setShowBudgetForm(false); fetchData();
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed", type: "error" });
    } finally { setSaving(false); }
  };

  const handleCreateCategory = async () => {
    if (!categoryForm.name || !categoryForm.code || !categoryForm.type) { setToast({ message: "Name, code, type required", type: "error" }); return; }
    setSaving(true);
    try {
      await api.post("/finance/budget-categories", categoryForm);
      setToast({ message: "Category created", type: "success" }); setShowCategoryForm(false); fetchData();
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed", type: "error" });
    } finally { setSaving(false); }
  };

  if (loading || !summary) return <PageWrapper title="Budget Overview" subtitle="Finance"><LoadingSpinner /></PageWrapper>;

  // Show every category that isn't pure revenue. Categories may use varied types
  // ("operational", "capital", "expense", etc.) depending on the org's seed.
  const spendingCategories = summary.byCategory.filter((c) => (c.categoryType || "").toLowerCase() !== "revenue");
  const donutData = spendingCategories.filter((c) => c.spent > 0).map((c) => ({ name: c.category, value: c.spent }));
  const barData = spendingCategories.map((c) => ({ name: c.category, Allocated: c.allocated / 1000, Spent: c.spent / 1000 }));
  const catOptions = categories.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }));

  return (
    <PageWrapper title="Budget Overview" subtitle={`Finance - FY ${summary.fiscalYear}`}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Allocated" value={formatCurrency(summary.totalAllocated)} icon={<DollarSign size={20} />} />
        <StatCard title="Total Spent" value={formatCurrency(summary.totalSpent)} icon={<TrendingUp size={20} />} />
        <StatCard title="Remaining" value={formatCurrency(summary.totalRemaining)} icon={<PieChart size={20} />} />
        <StatCard title="Utilization" value={formatPercent(summary.utilizationRate)} icon={<AlertTriangle size={20} />} />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button onClick={() => { setBudgetForm(emptyBudgetForm); setShowBudgetForm(true); }}><Plus size={16} /> Add Budget</Button>
        <Button variant="secondary" onClick={() => { setCategoryForm(emptyCategoryForm); setShowCategoryForm(true); }}><Plus size={16} /> Add Category</Button>
        <a href="/finance/statements" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6] hover:bg-[#5B21B6] hover:text-white transition-colors ml-auto">
          <FileBarChart size={14} /> Open Financial Statements
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Allocated vs Spent (K)</h3></CardHeader>
          <CardBody>{barData.length > 0 ? <BarChartWidget data={barData} bars={[{ key: "Allocated", color: "#5B21B6" }, { key: "Spent", color: "#D97706" }]} xKey="name" height={300} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Spending by Category</h3></CardHeader>
          <CardBody>{donutData.length > 0 ? <DonutChartWidget data={donutData} height={300} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}</CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Category Details</h3></CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
            {["Category", "Type", "Allocated", "Spent", "Remaining", "Utilization", "Status"].map((h) => <th key={h} className="text-left py-2 px-3 text-xs font-medium text-[#9B93B8]">{h}</th>)}
          </tr></thead><tbody>
            {summary.byCategory.map((cat) => (
              <tr key={cat.category} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                <td className="py-3 px-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{cat.category}</td>
                <td className="py-3 px-3"><Badge variant="purple">{cat.categoryType}</Badge></td>
                <td className="py-3 px-3">{formatCurrency(cat.allocated)}</td>
                <td className="py-3 px-3">{formatCurrency(cat.spent)}</td>
                <td className="py-3 px-3">{formatCurrency(cat.remaining)}</td>
                <td className="py-3 px-3 font-medium">{formatPercent(cat.utilization)}</td>
                <td className="py-3 px-3"><Badge variant={cat.utilization > 90 ? "danger" : cat.utilization > 70 ? "warning" : "success"}>
                  {cat.utilization > 90 ? "Over" : cat.utilization > 70 ? "Warning" : "On Track"}
                </Badge></td>
              </tr>
            ))}
          </tbody></table>
        </CardBody>
      </Card>

      <Modal open={showBudgetForm} onClose={() => setShowBudgetForm(false)} title="Add Annual Budget" size="md">
        <div className="space-y-4">
          <FormSelect label="Category" value={budgetForm.categoryId} onChange={(v) => setBudgetForm((p) => ({ ...p, categoryId: v }))} options={catOptions} required placeholder="Select category" />
          <FormInput label="Fiscal Year" value={budgetForm.fiscalYear} onChange={(v) => setBudgetForm((p) => ({ ...p, fiscalYear: v }))} type="number" required />
          <FormInput label="Allocated Amount" value={budgetForm.allocatedAmount} onChange={(v) => setBudgetForm((p) => ({ ...p, allocatedAmount: v }))} type="number" required />
          <FormTextarea label="Notes" value={budgetForm.notes} onChange={(v) => setBudgetForm((p) => ({ ...p, notes: v }))} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowBudgetForm(false)}>Cancel</Button>
          <Button onClick={handleCreateBudget} loading={saving}>Create Budget</Button>
        </div>
      </Modal>

      <Modal open={showCategoryForm} onClose={() => setShowCategoryForm(false)} title="Add Budget Category" size="sm">
        <div className="space-y-4">
          <FormInput label="Name" value={categoryForm.name} onChange={(v) => setCategoryForm((p) => ({ ...p, name: v }))} required />
          <FormInput label="Code" value={categoryForm.code} onChange={(v) => setCategoryForm((p) => ({ ...p, code: v }))} required placeholder="e.g. PERS, TECH" />
          <FormSelect label="Type" value={categoryForm.type} onChange={(v) => setCategoryForm((p) => ({ ...p, type: v }))} options={[
            { value: "expense", label: "Expense" }, { value: "revenue", label: "Revenue" }, { value: "capital", label: "Capital" },
          ]} />
          <FormTextarea label="Description" value={categoryForm.description} onChange={(v) => setCategoryForm((p) => ({ ...p, description: v }))} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowCategoryForm(false)}>Cancel</Button>
          <Button onClick={handleCreateCategory} loading={saving}>Create</Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
