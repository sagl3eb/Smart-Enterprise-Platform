import { useState, useEffect, useCallback, useMemo } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { BarChartWidget, DonutChartWidget } from "../../components/charts/Charts";
import { HardHat, DollarSign, Package, AlertTriangle, TrendingUp, Boxes, Truck } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";
import api from "../../api/client";
import type { Project, Material } from "../../types";

type Section = "projects" | "materials" | "suppliers";

interface Supplier { id: string; name: string; category: string | null; rating: number | null; isActive: boolean; }

export default function AdminConstruction() {
  const [section, setSection] = useState<Section>("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [lowStock, setLowStock] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, stockRes, matRes, supRes] = await Promise.allSettled([
        api.get("/construction/projects?limit=100"),
        api.get("/construction/materials/low-stock"),
        api.get("/construction/materials?limit=200"),
        api.get("/construction/suppliers?limit=100"),
      ]);
      if (projRes.status === "fulfilled") setProjects(projRes.value.data.data || []);
      if (stockRes.status === "fulfilled") setLowStock(stockRes.value.data.data || []);
      if (matRes.status === "fulfilled") setMaterials(matRes.value.data.data || []);
      if (supRes.status === "fulfilled") setSuppliers(supRes.value.data.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // All hooks must run on every render — keep them above any early return.
  const materialValueByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of materials) {
      const c = m.category || "Other";
      map[c] = (map[c] || 0) + (Number((m as any).unitPrice) || 0) * (m.stockQty || 0);
    }
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [materials]);

  const stockHealth = useMemo(() => {
    let healthy = 0, low = 0, out = 0;
    for (const m of materials) {
      if (m.stockQty <= 0) out++;
      else if (m.stockQty < (m.reorderLevel || 0)) low++;
      else healthy++;
    }
    return [
      { name: "Healthy", value: healthy },
      { name: "Below reorder", value: low },
      { name: "Out of stock", value: out },
    ];
  }, [materials]);

  const supplierByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of suppliers) {
      const c = s.category || "Uncategorized";
      map[c] = (map[c] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [suppliers]);

  const tabNav = (
    <div className="flex gap-1 mb-6 border-b border-[#E8E4F3] dark:border-[#2E2850]">
      {([
        { key: "projects" as Section, label: "Projects", icon: HardHat },
        { key: "materials" as Section, label: "Materials & Stock", icon: Boxes },
        { key: "suppliers" as Section, label: "Suppliers", icon: Truck },
      ]).map((t) => {
        const Icon = t.icon;
        const active = section === t.key;
        return (
          <button key={t.key} onClick={() => setSection(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              active ? "border-[#5B21B6] text-[#5B21B6] dark:text-[#C4B5FD]"
                : "border-transparent text-[#9B93B8] hover:text-[#4C4566] dark:hover:text-[#B8AEDD]"
            }`}>
            <Icon size={14} />{t.label}
          </button>
        );
      })}
    </div>
  );

  if (loading) return <PageWrapper title="Projects Administration" subtitle="Admin View">{tabNav}<LoadingSpinner /></PageWrapper>;

  const totalBudget = projects.reduce((s, p) => s + (p.estimatedBudget || 0), 0);
  const avgProgress = projects.length > 0 ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0;
  const activeCount = projects.filter((p) => ["active", "in_progress"].includes(p.status)).length;

  const statusBreakdown = projects.reduce<Record<string, number>>((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});
  const progressData = projects.slice(0, 10).map((p) => ({ name: p.code, progress: p.progress, budget: Math.round((p.estimatedBudget || 0) / 1000) }));

  const ratedSuppliers = suppliers.filter((x) => x.rating && x.rating > 0);
  const supplierAvgRating = ratedSuppliers.length > 0
    ? ratedSuppliers.reduce((s, x) => s + (x.rating || 0), 0) / ratedSuppliers.length
    : 0;

  const subtitle = section === "materials" ? "Admin View - Stock health & material insights"
    : section === "suppliers" ? "Admin View - Supplier mix & ratings"
    : "Admin View - Project portfolio & budget oversight";

  return (
    <PageWrapper title="Projects Administration" subtitle={subtitle}>
      {tabNav}

      {section === "projects" && (<>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Projects" value={String(projects.length)} icon={<HardHat size={20} />} />
          <StatCard title="Active" value={String(activeCount)} icon={<TrendingUp size={20} />} />
          <StatCard title="Total Budget" value={formatCurrency(totalBudget)} icon={<DollarSign size={20} />} />
          <StatCard title="Avg Progress" value={`${avgProgress}%`} icon={<TrendingUp size={20} />} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Progress & Budget (k)</h3></CardHeader>
            <CardBody>
              {progressData.length > 0 ? <BarChartWidget data={progressData} bars={[{ key: "progress", color: "#5B21B6" }, { key: "budget", color: "#D97706" }]} xKey="name" height={280} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">By Status</h3></CardHeader>
            <CardBody>
              <DonutChartWidget data={Object.entries(statusBreakdown).map(([name, value]) => ({ name: name.replace("_", " "), value }))} height={260} innerRadius={50} outerRadius={85} />
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">All Projects</h3></CardHeader>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm"><thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
              {["Code", "Name", "Progress", "Estimated", "Actual", "Variance", "Status"].map((h) => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-[#9B93B8]">{h}</th>)}
            </tr></thead><tbody>
              {projects.map((p) => {
                const variance = (p.actualBudget || 0) - (p.estimatedBudget || 0);
                return (
                  <tr key={p.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                    <td className="px-3 py-2 font-mono text-xs text-[#5B21B6]">{p.code}</td>
                    <td className="px-3 py-2 text-[#1E1B2E] dark:text-[#EDE9FE]">{p.name}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#EDE9FE] dark:bg-[#2D1F5E] rounded-full overflow-hidden">
                          <div className="h-full bg-[#5B21B6] rounded-full" style={{ width: `${p.progress}%` }} />
                        </div>
                        <span className="text-xs">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs font-serif">{p.estimatedBudget ? formatCurrency(p.estimatedBudget) : "—"}</td>
                    <td className="px-3 py-2 text-xs font-serif">{p.actualBudget ? formatCurrency(p.actualBudget) : "—"}</td>
                    <td className={`px-3 py-2 text-xs font-serif ${variance > 0 ? "text-red-600 dark:text-red-400" : variance < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{variance ? formatCurrency(variance) : "—"}</td>
                    <td className="px-3 py-2"><Badge variant={["active", "in_progress"].includes(p.status) ? "success" : p.status === "completed" ? "info" : "default"}>{p.status.replace("_", " ")}</Badge></td>
                  </tr>
                );
              })}
            </tbody></table>
          </CardBody>
        </Card>
      </>)}

      {section === "materials" && (<>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Materials" value={String(materials.length)} icon={<Boxes size={20} />} />
          <StatCard title="Low Stock" value={String(lowStock.length)} icon={<AlertTriangle size={20} />} />
          <StatCard title="Out of Stock" value={String(materials.filter((m) => m.stockQty <= 0).length)} icon={<AlertTriangle size={20} />} />
          <StatCard title="Stock Value" value={formatCurrency(materialValueByCategory.reduce((s, x) => s + x.value, 0))} icon={<DollarSign size={20} />} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Stock Value by Category</h3></CardHeader>
            <CardBody>
              {materialValueByCategory.length > 0 ? <BarChartWidget data={materialValueByCategory} bars={[{ key: "value", color: "#5B21B6" }]} xKey="name" height={260} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Stock Health</h3></CardHeader>
            <CardBody>
              <DonutChartWidget data={stockHealth} height={260} innerRadius={50} outerRadius={85} colors={["#10B981", "#F59E0B", "#DC2626"]} />
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Package size={16} className="text-[#D97706]" />
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Low Stock Alerts</h3>
          </CardHeader>
          <CardBody>
            {lowStock.length === 0 ? <EmptyState title="All materials in stock" /> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Code", "Name", "Category", "Stock", "Reorder Level", "Unit"].map((h) => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-[#9B93B8]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {lowStock.map((m) => (
                    <tr key={m.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-[#5B21B6]">{m.code}</td>
                      <td className="px-3 py-2 text-[#1E1B2E] dark:text-[#EDE9FE]">{m.name}</td>
                      <td className="px-3 py-2"><Badge variant="purple">{m.category}</Badge></td>
                      <td className="px-3 py-2 font-bold text-red-600 dark:text-red-400">{m.stockQty}</td>
                      <td className="px-3 py-2 text-xs text-[#9B93B8]">{m.reorderLevel}</td>
                      <td className="px-3 py-2 text-xs text-[#9B93B8]">{m.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </>)}

      {section === "suppliers" && (<>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Suppliers" value={String(suppliers.length)} icon={<Truck size={20} />} />
          <StatCard title="Active" value={String(suppliers.filter((s) => s.isActive).length)} icon={<Truck size={20} />} />
          <StatCard title="Categories" value={String(supplierByCategory.length)} icon={<Package size={20} />} />
          <StatCard title="Avg Rating" value={supplierAvgRating > 0 ? supplierAvgRating.toFixed(1) : "—"} icon={<TrendingUp size={20} />} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Suppliers by Category</h3></CardHeader>
            <CardBody>
              {supplierByCategory.length > 0 ? <BarChartWidget data={supplierByCategory.map(({ name, value }) => ({ name, count: value }))} bars={[{ key: "count", color: "#5B21B6" }]} xKey="name" height={260} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Active vs Inactive</h3></CardHeader>
            <CardBody>
              <DonutChartWidget
                data={[
                  { name: "Active", value: suppliers.filter((s) => s.isActive).length },
                  { name: "Inactive", value: suppliers.filter((s) => !s.isActive).length },
                ]}
                height={260} innerRadius={50} outerRadius={85}
                colors={["#10B981", "#9CA3AF"]}
              />
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Supplier Directory</h3></CardHeader>
          <CardBody className="overflow-x-auto p-0">
            {suppliers.length === 0 ? <div className="p-5"><EmptyState title="No suppliers yet" /></div> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Name", "Category", "Rating", "Status"].map((h) => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-[#9B93B8]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                      <td className="px-3 py-2 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{s.name}</td>
                      <td className="px-3 py-2"><Badge variant="purple">{s.category || "—"}</Badge></td>
                      <td className="px-3 py-2 text-xs">{s.rating != null ? `${s.rating}/5` : "—"}</td>
                      <td className="px-3 py-2"><Badge variant={s.isActive ? "success" : "default"}>{s.isActive ? "Active" : "Inactive"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </>)}
    </PageWrapper>
  );
}
