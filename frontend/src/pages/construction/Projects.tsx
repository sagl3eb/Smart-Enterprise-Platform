import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { BarChartWidget } from "../../components/charts/Charts";
import { HardHat, Plus, Search, MapPin, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { formatCurrency, formatDate, formatPercent } from "../../utils/formatters";
import api from "../../api/client";
import type { Project } from "../../types";

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => { fetchData(); }, [statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/construction/projects?${params}`);
      setProjects(res.data.data || []);
    } catch {
      setProjects([
        { id: "1", name: "Marina Bay Office Tower", code: "PRJ-001", description: "35-story commercial office building", clientName: "Bay Development Corp", startDate: "2024-01-15", endDate: "2025-12-31", estimatedBudget: 12000000, actualBudget: 5800000, status: "active", progress: 48, managerId: null, location: "Marina Bay, District 1", _count: { milestones: 8, tasks: 45, siteReports: 120 } },
        { id: "2", name: "Highway 7 Bridge Expansion", code: "PRJ-002", description: "Bridge widening from 4 to 6 lanes", clientName: "City Transport Authority", startDate: "2024-03-01", endDate: "2025-06-30", estimatedBudget: 8500000, actualBudget: 4200000, status: "active", progress: 62, managerId: null, location: "Highway 7 KM 45", _count: { milestones: 6, tasks: 32, siteReports: 85 } },
        { id: "3", name: "Green Valley Residential", code: "PRJ-003", description: "120-unit residential complex with amenities", clientName: "Valley Properties", startDate: "2023-06-01", endDate: "2024-11-30", estimatedBudget: 15000000, actualBudget: 14200000, status: "completed", progress: 100, managerId: null, location: "Green Valley Estate", _count: { milestones: 10, tasks: 68, siteReports: 210 } },
        { id: "4", name: "Industrial Zone Warehouse", code: "PRJ-004", description: "50,000 sqft warehouse facility", clientName: "LogiPlex Inc", startDate: "2024-08-01", endDate: "2025-04-30", estimatedBudget: 3200000, actualBudget: 850000, status: "active", progress: 25, managerId: null, location: "Industrial Zone B, Lot 15", _count: { milestones: 5, tasks: 22, siteReports: 35 } },
        { id: "5", name: "Community Center Renovation", code: "PRJ-005", description: "Full renovation of Eastside community center", clientName: "City Council", startDate: "2024-10-01", endDate: null, estimatedBudget: 1800000, actualBudget: 200000, status: "planning", progress: 5, managerId: null, location: "Eastside, Block 12", _count: { milestones: 3, tasks: 8, siteReports: 2 } },
      ]);
    } finally { setLoading(false); }
  };

  const activeCount = projects.filter((p) => p.status === "active").length;
  const totalBudget = projects.reduce((s, p) => s + (p.estimatedBudget || 0), 0);
  const avgProgress = projects.length > 0 ? projects.reduce((s, p) => s + p.progress, 0) / projects.length : 0;

  const progressData = projects.slice(0, 6).map((p) => ({ name: p.code, progress: p.progress }));
  const statusColorMap: Record<string, string> = { active: "bg-emerald-500", completed: "bg-blue-500", planning: "bg-amber-500", on_hold: "bg-gray-400", cancelled: "bg-red-500" };

  return (
    <PageWrapper title="Construction Projects" subtitle="Construction Logistics — Project overview">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Projects" value={String(projects.length)} icon={<HardHat size={20} />} />
        <StatCard title="Active" value={String(activeCount)} icon={<TrendingUp size={20} />} />
        <StatCard title="Total Budget" value={formatCurrency(totalBudget)} icon={<DollarSign size={20} />} />
        <StatCard title="Avg Progress" value={formatPercent(avgProgress)} icon={<Calendar size={20} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Statuses</option>
          {["planning", "active", "on_hold", "completed", "cancelled"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium text-white bg-[#5B21B6] hover:bg-[#7C3AED] transition-colors ml-auto">
          <Plus size={16} /> New Project
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 space-y-4">
          {loading ? <LoadingSpinner /> : projects.length === 0 ? <EmptyState title="No projects found" icon={<HardHat size={32} />} /> :
            projects.map((project) => (
              <Card key={project.id}>
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-[#5B21B6]">{project.code}</span>
                        <Badge variant={project.status === "active" ? "success" : project.status === "completed" ? "info" : project.status === "planning" ? "warning" : "default"}>
                          {project.status}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{project.name}</h3>
                    </div>
                    <span className="text-lg font-bold font-serif text-[#5B21B6]">{project.progress}%</span>
                  </div>
                  {project.description && <p className="text-xs text-[#9B93B8] mb-3 line-clamp-1">{project.description}</p>}
                  <div className="h-2 bg-[#EDE9FE] dark:bg-[#2D1F5E] rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full ${statusColorMap[project.status] || "bg-[#5B21B6]"}`} style={{ width: `${project.progress}%` }} />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-[10px] text-[#9B93B8]">
                    {project.clientName && <span>Client: {project.clientName}</span>}
                    {project.location && <span className="flex items-center gap-0.5"><MapPin size={10} />{project.location}</span>}
                    <span>{formatDate(project.startDate)} — {project.endDate ? formatDate(project.endDate) : "Ongoing"}</span>
                    {project.estimatedBudget && <span>Budget: {formatCurrency(project.estimatedBudget)}</span>}
                    {project._count && <span>{project._count.tasks} tasks · {project._count.milestones} milestones</span>}
                  </div>
                </CardBody>
              </Card>
            ))
          }
        </div>
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Progress Overview</h3></CardHeader>
          <CardBody><BarChartWidget data={progressData} bars={[{ key: "progress", color: "#5B21B6" }]} xKey="name" height={300} /></CardBody>
        </Card>
      </div>
    </PageWrapper>
  );
}
