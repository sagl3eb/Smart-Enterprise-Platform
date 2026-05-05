import { useState, useEffect, useCallback, useMemo } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner } from "../../components/ui/Card";
import { Toast } from "../../components/ui/Modal";
import { DonutChartWidget, BarChartWidget } from "../../components/charts/Charts";
import { Key, Users, DollarSign, AlertTriangle, Search } from "lucide-react";
import { formatCurrency, formatDate } from "../../utils/formatters";
import api from "../../api/client";
import ICTSubNav from "./ICTSubNav";

interface License {
  id: string;
  softwareName: string;
  vendor: string | null;
  licenseType: string;
  totalSeats: number;
  usedSeats: number;
  purchaseDate: string;
  expiryDate: string | null;
  annualCost: number | null;
  status: string;
  notes: string | null;
}

const ASSIGN_TAG = /^\[assigned:([0-9a-f,\-]*)\]\s*\n?/i;
function countAssigned(notes: string | null): number {
  if (!notes) return 0;
  const m = notes.match(ASSIGN_TAG);
  if (!m) return 0;
  return m[1].split(",").filter(Boolean).length;
}

export default function AdminLicenses() {
  return (
    <PageWrapper title="License Administration" subtitle="Admin View - Seat utilization, cost & expiry oversight">
      <ICTSubNav />
      <AdminLicensesPanel />
    </PageWrapper>
  );
}

export function AdminLicensesPanel() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [vendorFilter, setVendorFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [usageSearch, setUsageSearch] = useState("");
  const [seatFilter, setSeatFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/ict/licenses?limit=500");
      setLicenses(res.data.data || []);
    } catch { setLicenses([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const totalSeats = licenses.reduce((s, l) => s + l.totalSeats, 0);
    const usedSeats = licenses.reduce((s, l) => s + countAssigned(l.notes), 0);
    const totalCost = licenses.reduce((s, l) => s + (Number(l.annualCost) || 0), 0);
    const now = new Date();
    const in90 = new Date(Date.now() + 90 * 86400000);
    const expiringSoon = licenses.filter((l) => l.expiryDate && new Date(l.expiryDate) < in90 && new Date(l.expiryDate) > now);
    const utilization = totalSeats > 0 ? Math.round((usedSeats / totalSeats) * 100) : 0;
    return { totalSeats, usedSeats, totalCost, expiringSoon, utilization };
  }, [licenses]);

  const byVendor = useMemo(() => {
    const map: Record<string, { name: string; value: number; seats: number; cost: number }> = {};
    for (const l of licenses) {
      const v = l.vendor || "Unknown";
      if (!map[v]) map[v] = { name: v, value: 0, seats: 0, cost: 0 };
      map[v].value += 1;
      map[v].seats += l.totalSeats;
      map[v].cost += Number(l.annualCost) || 0;
    }
    return Object.values(map).sort((a, b) => b.cost - a.cost);
  }, [licenses]);

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of licenses) {
      map[l.licenseType] = (map[l.licenseType] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [licenses]);

  const utilizationByLicense = useMemo(() =>
    licenses
      .filter((l) => l.totalSeats > 0)
      .map((l) => ({
        name: l.softwareName.length > 18 ? l.softwareName.slice(0, 18) + "…" : l.softwareName,
        Utilization: Math.round((countAssigned(l.notes) / l.totalSeats) * 100),
      }))
      .sort((a, b) => b.Utilization - a.Utilization)
      .slice(0, 8)
  , [licenses]);

  const filteredList = useMemo(() => {
    const s = usageSearch.trim().toLowerCase();
    return licenses
      .filter((l) => !vendorFilter || l.vendor === vendorFilter)
      .filter((l) => !typeFilter || l.licenseType === typeFilter)
      .filter((l) => !statusFilter || l.status === statusFilter)
      .filter((l) => {
        if (!seatFilter) return true;
        const used = countAssigned(l.notes);
        if (seatFilter === "underutilized") return l.totalSeats > 0 && used / l.totalSeats < 0.5;
        if (seatFilter === "saturated") return l.totalSeats > 0 && used / l.totalSeats >= 0.9;
        if (seatFilter === "unassigned") return used === 0;
        return true;
      })
      .filter((l) => {
        if (!s) return true;
        const hay = `${l.softwareName} ${l.vendor || ""} ${l.licenseType} ${l.status}`.toLowerCase();
        return hay.includes(s);
      });
  }, [licenses, vendorFilter, typeFilter, statusFilter, seatFilter, usageSearch]);

  const filteredSummary = useMemo(() => {
    const total = filteredList.length;
    const seats = filteredList.reduce((s, l) => s + l.totalSeats, 0);
    const used = filteredList.reduce((s, l) => s + countAssigned(l.notes), 0);
    const cost = filteredList.reduce((s, l) => s + (Number(l.annualCost) || 0), 0);
    const utilization = seats > 0 ? Math.round((used / seats) * 100) : 0;
    return { total, seats, used, cost, utilization };
  }, [filteredList]);

  const vendorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of licenses) if (l.vendor) set.add(l.vendor);
    return Array.from(set).sort();
  }, [licenses]);

  if (loading) return <LoadingSpinner />;

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Licenses" value={String(licenses.length)} icon={<Key size={20} />} />
        <StatCard title="Seats (Used / Total)" value={`${stats.usedSeats} / ${stats.totalSeats}`} icon={<Users size={20} />} subtitle={`${stats.utilization}% utilized`} />
        <StatCard title="Annual Cost" value={formatCurrency(stats.totalCost)} icon={<DollarSign size={20} />} />
        <StatCard title="Expiring <90d" value={String(stats.expiringSoon.length)} icon={<AlertTriangle size={20} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 items-start">
        <Card className="lg:col-span-2">
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Top Seat Utilization</h3></CardHeader>
          <CardBody>
            {utilizationByLicense.length === 0
              ? <p className="text-xs text-[#9B93B8] text-center py-8">No license data</p>
              : <BarChartWidget data={utilizationByLicense} bars={[{ key: "Utilization", color: "#5B21B6" }]} xKey="name" height={280} />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">By License Type</h3></CardHeader>
          <CardBody>
            {byType.length === 0
              ? <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>
              : <DonutChartWidget data={byType} height={260} innerRadius={55} outerRadius={90} />}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-start">
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Spend by Vendor</h3></CardHeader>
          <CardBody className="overflow-x-auto">
            {byVendor.length === 0 ? <p className="text-xs text-[#9B93B8] text-center py-8">No vendors</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Vendor", "Licenses", "Total Seats", "Annual Cost"].map((h) => <th key={h} className="text-left py-2 px-3 text-xs font-medium text-[#9B93B8]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {byVendor.map((v) => (
                    <tr key={v.name} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                      <td className="py-2 px-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{v.name}</td>
                      <td className="py-2 px-3 text-[#4C4566] dark:text-[#B8AEDD]">{v.value}</td>
                      <td className="py-2 px-3 text-[#4C4566] dark:text-[#B8AEDD]">{v.seats}</td>
                      <td className="py-2 px-3 font-serif">{formatCurrency(v.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Expiring in next 90 days</h3></CardHeader>
          <CardBody>
            {stats.expiringSoon.length === 0 ? (
              <p className="text-xs text-[#9B93B8] text-center py-8">No licenses expiring soon</p>
            ) : (
              <div className="space-y-2">
                {stats.expiringSoon.map((l) => {
                  const days = Math.ceil((new Date(l.expiryDate!).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={l.id} className="flex items-center justify-between py-2 border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                      <div>
                        <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{l.softwareName}</p>
                        <p className="text-[10px] text-[#9B93B8]">{l.vendor || "—"} · expires {formatDate(l.expiryDate!)}</p>
                      </div>
                      <Badge variant={days < 30 ? "danger" : "warning"}>{days}d left</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key size={16} className="text-[#5B21B6]" />
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">All Licenses</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
              <input value={usageSearch} onChange={(e) => setUsageSearch(e.target.value)} placeholder="Search by software, vendor, type..."
                className="w-full pl-9 pr-4 py-2 rounded-[8px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
            </div>
            <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
              className="px-3 py-2 rounded-[8px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
              <option value="">All Vendors</option>
              {vendorOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-[8px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
              <option value="">All Types</option>
              {["subscription", "perpetual", "volume", "oem"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-[8px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
              <option value="">All Statuses</option>
              {["active", "expired", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={seatFilter} onChange={(e) => setSeatFilter(e.target.value)}
              className="px-3 py-2 rounded-[8px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
              <option value="">Any usage</option>
              <option value="unassigned">No seats assigned</option>
              <option value="underutilized">Under 50% used</option>
              <option value="saturated">Over 90% used</option>
            </select>
            <button
              onClick={() => { setVendorFilter(""); setTypeFilter(""); setStatusFilter(""); setSeatFilter(""); setUsageSearch(""); }}
              className="px-3 py-2 text-xs rounded-[8px] text-[#5B21B6] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E]"
            >
              Clear
            </button>
          </div>

          {filteredList.length === 0 ? <p className="text-xs text-[#9B93B8] text-center py-8">No licenses match these filters</p> : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-[#F8F7FF] dark:bg-[#1A1635]">
                  <p className="text-[10px] uppercase text-[#9B93B8]">Matching</p>
                  <p className="text-base font-bold text-[#1E1B2E] dark:text-[#EDE9FE]">{filteredSummary.total}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#F8F7FF] dark:bg-[#1A1635]">
                  <p className="text-[10px] uppercase text-[#9B93B8]">Seats Assigned</p>
                  <p className="text-base font-bold text-emerald-600">{filteredSummary.used} / {filteredSummary.seats}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#F8F7FF] dark:bg-[#1A1635]">
                  <p className="text-[10px] uppercase text-[#9B93B8]">Utilization</p>
                  <p className="text-base font-bold text-[#5B21B6]">{filteredSummary.utilization}%</p>
                </div>
                <div className="p-3 rounded-lg bg-[#F8F7FF] dark:bg-[#1A1635]">
                  <p className="text-[10px] uppercase text-[#9B93B8]">Annual Cost</p>
                  <p className="text-base font-bold text-[#5B21B6]">{formatCurrency(filteredSummary.cost)}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                      {["Software", "Vendor", "Type", "Seats", "Assigned", "Annual Cost", "Expiry", "Status"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-medium text-[#9B93B8]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.slice(0, 100).map((lic) => {
                      const assignedCount = countAssigned(lic.notes);
                      const usage = lic.totalSeats > 0 ? Math.round((assignedCount / lic.totalSeats) * 100) : 0;
                      return (
                        <tr key={lic.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                          <td className="px-3 py-2 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{lic.softwareName}</td>
                          <td className="px-3 py-2 text-[#4C4566] dark:text-[#B8AEDD]">{lic.vendor || "—"}</td>
                          <td className="px-3 py-2"><Badge variant="purple">{lic.licenseType}</Badge></td>
                          <td className="px-3 py-2 text-[#4C4566] dark:text-[#B8AEDD]">
                            <div className="flex items-center gap-2">
                              <span>{assignedCount} / {lic.totalSeats}</span>
                              <div className="w-14 h-1.5 bg-[#EDE9FE] dark:bg-[#2D1F5E] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${usage > 90 ? "bg-red-500" : usage > 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(usage, 100)}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-[#4C4566] dark:text-[#B8AEDD]">{assignedCount} employee{assignedCount === 1 ? "" : "s"}</td>
                          <td className="px-3 py-2 font-serif">{lic.annualCost ? formatCurrency(lic.annualCost) : "—"}</td>
                          <td className="px-3 py-2 text-xs text-[#9B93B8]">{lic.expiryDate ? formatDate(lic.expiryDate) : "Perpetual"}</td>
                          <td className="px-3 py-2"><Badge variant={lic.status === "active" ? "success" : lic.status === "expired" ? "danger" : "default"}>{lic.status}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredList.length > 100 && <p className="text-xs text-[#9B93B8] text-center py-2">Showing first 100 of {filteredList.length} — narrow the filters to see more.</p>}
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}
