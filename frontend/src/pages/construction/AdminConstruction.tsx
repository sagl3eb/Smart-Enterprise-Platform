import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { BarChartWidget, DonutChartWidget } from "../../components/charts/Charts";
import { HardHat, DollarSign, Package, AlertTriangle, TrendingUp, MapPin } from "lucide-react";
import { formatCurrency, formatPercent, formatDate } from "../../utils/formatters";
import api from "../../api/client";
import type { Project, Material } from "../../types";

export default function AdminConstruction() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [lowStock, setLowStock] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, stockRes] = await Promise.allSettled([
        api.get("/construction/projects?limit=50"),
        api.get("/construction/materials/low-stock"),
      ]);
      if (projRes.status === "fulfilled") setProjects(projRes.value.data.data || []);
      if (stockRes.status === "fulfilled") setLowStock(stockRes.value.data.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <PageWrapper title="Construction Administration" subtitle="Admin View"><LoadingSpinner /></PageWrapper>;

  const totalBudget = projects.reduce((s, p) => s + (p.estimatedBudget || 0), 0);
  const totalActual = projects.reduce((s, p) => s + (p.actualBudget || 0), 0);
  const avgProgress = projects.length > 0 ? projects.reduce((s, p) => s + p.progress, 0) / projects.length : 0;
  const activeCount = projects.filter((p) => ["active", "in_progress"].includes(p.status)).length;

  const statusBreakdown = projects.reduce<Record<string, number>>((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});
  const progressData = projects.slice(0, 8).map((p) => ({ name: p.code, progress: p.progress, budget: (p.estimatedBudget || 0) / 1000 }));

  return (
    <PageWrapper title="Construction Administration" subtitle="Admin View — Project portfolio, budget oversight, stock alerts">

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Projects" value={String(projects.length)} icon={<HardHat size={20} />} />
        <StatCard title="Active" value={String(activeCount)} icon={<TrendingUp size={20} />} />
        <StatCard title="Total Budget" value={formatCurrency(totalBudget)} icon={<DollarSign size={20} />} />
        <StatCard title="Low Stock Items" value={String(lowStock.length)} icon={<AlertTriangle size={20} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Project Progress & Budget (K)</h3></CardHeader>
          <CardBody>
            {progressData.length > 0 ? <BarChartWidget data={progressData} bars={[{ key: "progress", color: "#5B21B6" }, { key: "budget", color: "#D97706" }]} xKey="name" height={280} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">By Status</h3></CardHeader>
          <CardBody>
            <DonutChartWidget data={Object.entries(statusBreakdown).map(([name, value]) => ({ name: name.replace("_", " "), value }))} height={250} />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Summary Table */}
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">All Projects</h3></CardHeader>
          <CardBody className="overflow-x-auto">
            <table className="w-full text-sm"><thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
              {["Code", "Name", "Progress", "Budget", "Status"].map((h) => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-[#9B93B8]">{h}</th>)}
            </tr></thead><tbody>
              {projects.map((p) => (
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
                  <td className="px-3 py-2 text-xs">{p.estimatedBudget ? formatCurrency(p.estimatedBudget) : "—"}</td>
                  <td className="px-3 py-2"><Badge variant={["active", "in_progress"].includes(p.status) ? "success" : p.status === "completed" ? "info" : "default"}>{p.status.replace("_", " ")}</Badge></td>
                </tr>
              ))}
            </tbody></table>
          </CardBody>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Package size={16} className="text-[#D97706]" />
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Low Stock Materials</h3>
          </CardHeader>
          <CardBody>
            {lowStock.length === 0 ? <EmptyState title="All materials in stock" /> : (
              <div className="space-y-2">
                {lowStock.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                    <div>
                      <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{m.name}</p>
                      <p className="text-[10px] text-[#9B93B8]">{m.code} · {m.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">{m.stockQty} {m.unit}</p>
                      <p className="text-[10px] text-[#9B93B8]">Reorder: {m.reorderLevel}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  );
}
