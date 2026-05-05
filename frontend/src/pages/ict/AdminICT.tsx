import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner } from "../../components/ui/Card";
import { Button, Toast } from "../../components/ui/Modal";
import { BarChartWidget, DonutChartWidget } from "../../components/charts/Charts";
import { Monitor, Ticket, Key, DollarSign, AlertTriangle, Tag, Plus, Trash2, RefreshCw, Search, Layers } from "lucide-react";
import { formatCurrency, formatDate } from "../../utils/formatters";
import api from "../../api/client";
import useAuthStore from "../../store/authStore";
import useViewModeStore from "../../store/viewModeStore";
import { loadCategories, saveCategories, prefixFor, type CategoryPrefix } from "../../utils/assetCategories";
import { AdminLicensesPanel } from "./AdminLicenses";
import ICTSubNav from "./ICTSubNav";

type AdminSection = "assets" | "tickets" | "licenses";

function sectionFromPath(pathname: string): AdminSection {
  if (pathname.startsWith("/ict/tickets")) return "tickets";
  if (pathname.startsWith("/ict/licenses")) return "licenses";
  return "assets";
}

const EMPTY_ASSETS = {
  total: 0, totalValue: 0, expiringWarrantyCount: 0,
  byStatus: [] as Array<{ status: string; count: number }>,
  byCategory: [] as Array<{ category: string; count: number }>,
};

const EMPTY_TICKETS = {
  total: 0, open: 0, inProgress: 0, resolved: 0, avgResolutionHours: 0,
  byPriority: [] as Array<{ priority: string; count: number }>,
  byCategory: [] as Array<{ category: string; count: number }>,
};

export default function AdminICT() {
  const location = useLocation();
  const navigate = useNavigate();
  const section = sectionFromPath(location.pathname);
  const orgId = useAuthStore((s) => s.user?.organization?.id || null);
  const canWrite = useAuthStore((s) => s.canWriteModule());
  const setViewMode = useViewModeStore((s) => s.setMode);
  const [assetStats, setAssetStats] = useState<{ total: number; totalValue: number; expiringWarrantyCount: number; byStatus: Array<{ status: string; count: number }>; byCategory: Array<{ category: string; count: number }> } | null>(null);
  const [ticketStats, setTicketStats] = useState<{ total: number; open: number; inProgress: number; resolved: number; avgResolutionHours: number; byPriority: Array<{ priority: string; count: number }>; byCategory: Array<{ category: string; count: number }> } | null>(null);
  const [allAssets, setAllAssets] = useState<Array<{ id: string; assetTag: string; name: string; category: string; assignedTo: string | null; location: string | null; status: string; purchasePrice: number | null; warrantyExpiry: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryPrefix[]>([]);
  const [newCat, setNewCat] = useState({ category: "", prefix: "" });
  const [retagging, setRetagging] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Asset Usage filters
  const [usageSearch, setUsageSearch] = useState("");
  const [usageCategory, setUsageCategory] = useState("");
  const [usageStatus, setUsageStatus] = useState("");
  const [usageAssigned, setUsageAssigned] = useState("");

  useEffect(() => { setCategories(loadCategories(orgId)); }, [orgId]);

  const persistCategories = (next: CategoryPrefix[]) => { saveCategories(orgId, next); setCategories(next); };

  const addCategory = () => {
    const name = newCat.category.trim();
    const prefix = newCat.prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!name || !prefix) { setToast({ message: "Category and prefix required", type: "error" }); return; }
    if (categories.some((c) => c.category.toLowerCase() === name.toLowerCase())) {
      setToast({ message: "Category already exists", type: "error" }); return;
    }
    persistCategories([...categories, { category: name, prefix }]);
    setNewCat({ category: "", prefix: "" });
    setToast({ message: `Added ${name} → ${prefix}-XXX`, type: "success" });
  };

  const removeCategory = (name: string) => {
    persistCategories(categories.filter((c) => c.category !== name));
  };

  // Pulls every asset in the org and rewrites its tag using the current
  // category → prefix mapping. Useful after renaming a prefix or adding
  // a new custom category so legacy assets follow the new convention.
  const retagAllAssets = async () => {
    if (!confirm("This will re-generate asset tags for every asset using the current category prefixes. Continue?")) return;
    setRetagging(true);
    try {
      const res = await api.get("/ict/assets?limit=100");
      const assets: Array<{ id: string; assetTag: string; category: string }> = res.data.data || [];
      const usedSuffixes = new Set<string>();
      let updated = 0;
      for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        const prefix = prefixFor(orgId, a.category);
        // Sequential 4-digit suffix starting at 0001, skipping collisions.
        let n = i + 1;
        let suffix = String(n).padStart(4, "0");
        while (usedSuffixes.has(suffix)) { n++; suffix = String(n).padStart(4, "0"); }
        usedSuffixes.add(suffix);
        const newTag = `${prefix}-${suffix}`;
        if (newTag !== a.assetTag) {
          await api.put(`/ict/assets/${a.id}`, { assetTag: newTag });
          updated++;
        }
      }
      setToast({ message: `Retagged ${updated} asset(s)`, type: "success" });
      fetchData();
    } catch {
      setToast({ message: "Failed to retag assets", type: "error" });
    } finally { setRetagging(false); }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [assetRes, ticketRes, allAssetRes] = await Promise.allSettled([
        api.get("/ict/assets/stats"),
        api.get("/ict/tickets/stats"),
        api.get("/ict/assets?limit=500"),
      ]);
      const assetData = assetRes.status === "fulfilled" ? assetRes.value.data.data : null;
      const ticketData = ticketRes.status === "fulfilled" ? ticketRes.value.data.data : null;
      const allAssetData = allAssetRes.status === "fulfilled" ? (allAssetRes.value.data.data || []) : [];
      setAssetStats(assetData || EMPTY_ASSETS);
      setTicketStats(ticketData || EMPTY_TICKETS);
      setAllAssets(allAssetData);
    } catch {
      setAssetStats(EMPTY_ASSETS);
      setTicketStats(EMPTY_TICKETS);
      setAllAssets([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const a = assetStats;
  const t = ticketStats;

  if (loading && section !== "licenses") return (
    <PageWrapper title="ICT Administration" subtitle="Admin View">
      <ICTSubNav />
      <LoadingSpinner />
    </PageWrapper>
  );

  const subtitle = section === "tickets"
    ? "Admin View - Ticket metrics and resolution insights"
    : section === "licenses"
      ? "Admin View - License management"
      : "Admin View - Asset oversight, categories, and tag prefixes";

  return (
    <PageWrapper title="ICT Administration" subtitle={subtitle}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ICTSubNav />

      {section === "licenses" && <AdminLicensesPanel />}

      {section === "tickets" && (<>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Tickets" value={String(t?.total || 0)} icon={<Ticket size={20} />} />
          <StatCard title="Open" value={String(t?.open || 0)} icon={<AlertTriangle size={20} />} />
          <StatCard title="In Progress" value={String(t?.inProgress || 0)} icon={<RefreshCw size={20} />} />
          <StatCard title="Avg Resolution" value={`${t?.avgResolutionHours || 0}h`} icon={<AlertTriangle size={20} />} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Tickets by Priority</h3></CardHeader>
            <CardBody>
              {t?.byPriority && t.byPriority.length > 0 ? <DonutChartWidget data={t.byPriority.map((p) => ({ name: p.priority, value: p.count }))} height={260} innerRadius={50} outerRadius={85} colors={["#DC2626", "#F97316", "#EAB308", "#3B82F6"]} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Tickets by Category</h3></CardHeader>
            <CardBody>
              {t?.byCategory && t.byCategory.length > 0 ? <BarChartWidget data={t.byCategory.map((c) => ({ name: c.category, count: c.count }))} bars={[{ key: "count", color: "#5B21B6" }]} xKey="name" height={260} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Manage Tickets</h3>
            <a href="/ict/tickets" onClick={(e) => { e.preventDefault(); setViewMode("employee"); navigate("/ict/tickets"); }} className="text-xs inline-flex items-center gap-1 text-[#5B21B6] hover:underline">
              <Ticket size={12} /> Open Ticket Workspace
            </a>
          </CardHeader>
          <CardBody>
            <p className="text-xs text-[#9B93B8]">Use the Tickets workspace (employee view) to triage, assign, resolve, and respond to individual tickets. The metrics above summarise the current state across the organisation.</p>
          </CardBody>
        </Card>
      </>)}

      {section === "assets" && (<>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Assets" value={String(a?.total || 0)} icon={<Monitor size={20} />} />
        <StatCard title="Asset Value" value={formatCurrency(a?.totalValue || 0)} icon={<DollarSign size={20} />} />
        <StatCard title="Warranty Expiring" value={String(a?.expiringWarrantyCount || 0)} icon={<AlertTriangle size={20} />} />
        <StatCard title="Categories" value={String(categories.length)} icon={<Tag size={20} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Assets by Status</h3></CardHeader>
          <CardBody>
            {a?.byStatus && a.byStatus.length > 0 ? <DonutChartWidget data={a.byStatus.map((s) => ({ name: s.status, value: s.count }))} height={260} innerRadius={50} outerRadius={85} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Assets by Category</h3></CardHeader>
          <CardBody>
            {a?.byCategory && a.byCategory.length > 0 ? <BarChartWidget data={a.byCategory.map((c) => ({ name: c.category, count: c.count }))} bars={[{ key: "count", color: "#5B21B6" }]} xKey="name" height={260} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
          </CardBody>
        </Card>
      </div>

      {/* Asset Insights — value by category, top 10 most valuable, assignment ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Asset Value by Category</h3></CardHeader>
          <CardBody>
            {(() => {
              const valueByCategory: Record<string, number> = {};
              for (const asset of allAssets) {
                const cat = asset.category || "Uncategorized";
                valueByCategory[cat] = (valueByCategory[cat] || 0) + (asset.purchasePrice || 0);
              }
              const data = Object.entries(valueByCategory)
                .map(([name, value]) => ({ name, value: Math.round(value) }))
                .sort((a, b) => b.value - a.value);
              return data.length > 0 ? (
                <div style={{ width: "100%" }}>
                  <BarChartWidget data={data} bars={[{ key: "value", color: "#5B21B6" }]} xKey="name" height={300} currency />
                </div>
              ) : <p className="text-xs text-[#9B93B8] text-center py-8">No assets yet</p>;
            })()}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Top 10 Most Valuable Assets</h3></CardHeader>
          <CardBody className="overflow-x-auto p-0">
            {(() => {
              const top = [...allAssets]
                .filter((a) => (a.purchasePrice || 0) > 0)
                .sort((a, b) => (b.purchasePrice || 0) - (a.purchasePrice || 0))
                .slice(0, 10);
              return top.length === 0 ? (
                <p className="text-xs text-[#9B93B8] text-center py-8 px-4">No priced assets</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                      {["Tag", "Name", "Category", "Value"].map((h) => (
                        <th key={h} className="text-left px-4 py-2 text-xs font-medium text-[#9B93B8]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((asset) => (
                      <tr key={asset.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                        <td className="px-4 py-2 font-mono text-xs text-[#5B21B6]">{asset.assetTag}</td>
                        <td className="px-4 py-2 text-[#1E1B2E] dark:text-[#EDE9FE]">{asset.name}</td>
                        <td className="px-4 py-2"><Badge variant="purple">{asset.category}</Badge></td>
                        <td className="px-4 py-2 font-serif">{formatCurrency(asset.purchasePrice || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </CardBody>
        </Card>
      </div>

      {/* Asset Usage — all categories, not just software, with filters */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#5B21B6]" />
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Asset Usage</h3>
          </div>
          <a href="/ict/licenses" className="text-xs inline-flex items-center gap-1 text-[#5B21B6] hover:underline">
            <Key size={12} /> Open Licenses
          </a>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
              <input value={usageSearch} onChange={(e) => setUsageSearch(e.target.value)} placeholder="Search by tag, name, location..."
                className="w-full pl-9 pr-4 py-2 rounded-[8px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
            </div>
            <select value={usageCategory} onChange={(e) => setUsageCategory(e.target.value)}
              className="px-3 py-2 rounded-[8px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
              <option value="">All Categories</option>
              {[...new Set(allAssets.map((x) => x.category))].sort().map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={usageStatus} onChange={(e) => setUsageStatus(e.target.value)}
              className="px-3 py-2 rounded-[8px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
              <option value="">All Statuses</option>
              {["active", "maintenance", "retired", "disposed"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={usageAssigned} onChange={(e) => setUsageAssigned(e.target.value)}
              className="px-3 py-2 rounded-[8px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
              <option value="">Any assignment</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <Button variant="ghost" onClick={() => { setUsageSearch(""); setUsageCategory(""); setUsageStatus(""); setUsageAssigned(""); }}>Clear</Button>
          </div>

          <AssetUsageTable
            assets={allAssets}
            search={usageSearch}
            category={usageCategory}
            status={usageStatus}
            assigned={usageAssigned}
          />
        </CardBody>
      </Card>
      </>)}
    </PageWrapper>
  );
}

interface AssetRow {
  id: string; assetTag: string; name: string; category: string;
  assignedTo: string | null; location: string | null; status: string;
  purchasePrice: number | null; warrantyExpiry: string | null;
}

function AssetUsageTable({ assets, search, category, status, assigned }: {
  assets: AssetRow[]; search: string; category: string; status: string; assigned: string;
}) {
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (category && a.category !== category) return false;
      if (status && a.status !== status) return false;
      if (assigned === "assigned" && !a.assignedTo) return false;
      if (assigned === "unassigned" && a.assignedTo) return false;
      if (s) {
        const hay = `${a.assetTag} ${a.name} ${a.location || ""} ${a.assignedTo || ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [assets, search, category, status, assigned]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const assignedCount = filtered.filter((a) => !!a.assignedTo).length;
    const value = filtered.reduce((sum, a) => sum + (a.purchasePrice || 0), 0);
    const utilization = total > 0 ? Math.round((assignedCount / total) * 100) : 0;
    return { total, assignedCount, value, utilization };
  }, [filtered]);

  if (filtered.length === 0) return <p className="text-xs text-[#9B93B8] text-center py-8">No assets match these filters</p>;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-[#F8F7FF] dark:bg-[#1A1635]">
          <p className="text-[10px] uppercase text-[#9B93B8]">Matching</p>
          <p className="text-base font-bold text-[#1E1B2E] dark:text-[#EDE9FE]">{summary.total}</p>
        </div>
        <div className="p-3 rounded-lg bg-[#F8F7FF] dark:bg-[#1A1635]">
          <p className="text-[10px] uppercase text-[#9B93B8]">Assigned</p>
          <p className="text-base font-bold text-emerald-600">{summary.assignedCount}</p>
        </div>
        <div className="p-3 rounded-lg bg-[#F8F7FF] dark:bg-[#1A1635]">
          <p className="text-[10px] uppercase text-[#9B93B8]">Utilization</p>
          <p className="text-base font-bold text-[#5B21B6]">{summary.utilization}%</p>
        </div>
        <div className="p-3 rounded-lg bg-[#F8F7FF] dark:bg-[#1A1635]">
          <p className="text-[10px] uppercase text-[#9B93B8]">Total Value</p>
          <p className="text-base font-bold text-[#5B21B6]">{formatCurrency(summary.value)}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
              {["Tag", "Name", "Category", "Assigned To", "Location", "Value", "Warranty", "Status"].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs font-medium text-[#9B93B8]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((a) => (
              <tr key={a.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                <td className="px-3 py-2 font-mono text-xs text-[#5B21B6]">{a.assetTag}</td>
                <td className="px-3 py-2 text-[#1E1B2E] dark:text-[#EDE9FE]">{a.name}</td>
                <td className="px-3 py-2"><Badge variant="purple">{a.category}</Badge></td>
                <td className="px-3 py-2 text-[#4C4566] dark:text-[#B8AEDD]">{a.assignedTo || <span className="italic text-[#9B93B8]">Unassigned</span>}</td>
                <td className="px-3 py-2 text-[#4C4566] dark:text-[#B8AEDD]">{a.location || "—"}</td>
                <td className="px-3 py-2 font-serif">{a.purchasePrice ? formatCurrency(a.purchasePrice) : "—"}</td>
                <td className="px-3 py-2 text-xs text-[#9B93B8]">{a.warrantyExpiry ? formatDate(a.warrantyExpiry) : "—"}</td>
                <td className="px-3 py-2"><Badge variant={a.status === "active" ? "success" : a.status === "maintenance" ? "warning" : "default"}>{a.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 100 && <p className="text-xs text-[#9B93B8] text-center py-2">Showing first 100 of {filtered.length} — narrow the filters to see more.</p>}
      </div>
    </>
  );
}
