import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { DonutChartWidget } from "../../components/charts/Charts";
import { Monitor, Plus, Search, DollarSign, ShieldCheck, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate, statusColor } from "../../utils/formatters";
import api from "../../api/client";
import type { Asset } from "../../types";

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => { fetchData(); }, [categoryFilter, statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/ict/assets?${params}`);
      setAssets(res.data.data || []);
    } catch {
      setAssets([
        { id: "1", assetTag: "IT-001", name: "MacBook Pro 16\"", category: "Laptop", manufacturer: "Apple", model: "M3 Pro", serialNumber: "SN-12345", purchaseDate: "2024-03-15", purchasePrice: 2499, warrantyExpiry: "2027-03-15", status: "active", assignedTo: "John Doe", location: "Office A" },
        { id: "2", assetTag: "IT-002", name: "Dell OptiPlex 7090", category: "Desktop", manufacturer: "Dell", model: "7090", serialNumber: "SN-23456", purchaseDate: "2023-06-01", purchasePrice: 1200, warrantyExpiry: "2026-06-01", status: "active", assignedTo: "Jane Smith", location: "Office B" },
        { id: "3", assetTag: "IT-003", name: "HP LaserJet Pro", category: "Printer", manufacturer: "HP", model: "MFP M428", serialNumber: "SN-34567", purchaseDate: "2024-01-10", purchasePrice: 450, warrantyExpiry: "2025-01-10", status: "active", assignedTo: null, location: "Floor 2" },
        { id: "4", assetTag: "IT-004", name: "Cisco Switch 48-Port", category: "Network", manufacturer: "Cisco", model: "Catalyst 9200", serialNumber: "SN-45678", purchaseDate: "2023-09-20", purchasePrice: 3200, warrantyExpiry: "2026-09-20", status: "active", assignedTo: null, location: "Server Room" },
        { id: "5", assetTag: "IT-005", name: "Samsung Monitor 27\"", category: "Monitor", manufacturer: "Samsung", model: "U28E590D", serialNumber: "SN-56789", purchaseDate: "2024-05-12", purchasePrice: 380, warrantyExpiry: "2027-05-12", status: "maintenance", assignedTo: "Bob Wilson", location: "Office A" },
        { id: "6", assetTag: "IT-006", name: "ThinkPad X1 Carbon", category: "Laptop", manufacturer: "Lenovo", model: "Gen 11", serialNumber: "SN-67890", purchaseDate: "2022-11-01", purchasePrice: 1899, warrantyExpiry: "2024-11-01", status: "disposed", assignedTo: null, location: null },
      ]);
    } finally { setLoading(false); }
  };

  const totalValue = assets.reduce((s, a) => s + (a.purchasePrice || 0), 0);
  const activeCount = assets.filter((a) => a.status === "active").length;
  const categories = [...new Set(assets.map((a) => a.category))];
  const statusDonut = Object.entries(assets.reduce<Record<string, number>>((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {})).map(([name, value]) => ({ name, value }));

  return (
    <PageWrapper title="IT Assets" subtitle="ICT Management — Hardware & equipment inventory">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Assets" value={String(assets.length)} icon={<Monitor size={20} />} />
        <StatCard title="Active" value={String(activeCount)} icon={<ShieldCheck size={20} />} />
        <StatCard title="Total Value" value={formatCurrency(totalValue)} icon={<DollarSign size={20} />} />
        <StatCard title="Expiring Warranty" value={String(assets.filter((a) => a.warrantyExpiry && new Date(a.warrantyExpiry) < new Date(Date.now() + 90 * 86400000)).length)} icon={<AlertTriangle size={20} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Statuses</option>
          {["active", "maintenance", "retired", "disposed"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium text-white bg-[#5B21B6] hover:bg-[#7C3AED] transition-colors ml-auto">
          <Plus size={16} /> Add Asset
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {loading ? <LoadingSpinner /> : assets.length === 0 ? <EmptyState title="No assets found" icon={<Monitor size={32} />} /> : (
            <Card>
              <CardBody className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                      {["Tag", "Name", "Category", "Manufacturer", "Assigned To", "Location", "Value", "Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => (
                      <tr key={asset.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]">
                        <td className="px-4 py-3 font-mono font-medium text-[#5B21B6]">{asset.assetTag}</td>
                        <td className="px-4 py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{asset.name}</td>
                        <td className="px-4 py-3"><Badge variant="purple">{asset.category}</Badge></td>
                        <td className="px-4 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{asset.manufacturer || "—"}</td>
                        <td className="px-4 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{asset.assignedTo || "Unassigned"}</td>
                        <td className="px-4 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{asset.location || "—"}</td>
                        <td className="px-4 py-3 font-serif font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{asset.purchasePrice ? formatCurrency(asset.purchasePrice) : "—"}</td>
                        <td className="px-4 py-3"><Badge className={statusColor(asset.status)}>{asset.status}</Badge></td>
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
          <CardBody><DonutChartWidget data={statusDonut} height={200} innerRadius={45} outerRadius={70} /></CardBody>
        </Card>
      </div>
    </PageWrapper>
  );
}
