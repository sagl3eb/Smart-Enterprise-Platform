import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner } from "../../components/ui/Card";
import { BarChartWidget, DonutChartWidget } from "../../components/charts/Charts";
import { Monitor, Ticket, Key, Wifi, DollarSign, AlertTriangle } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";
import api from "../../api/client";

export default function AdminICT() {
  const [assetStats, setAssetStats] = useState<{ total: number; totalValue: number; expiringWarrantyCount: number; byStatus: Array<{ status: string; count: number }>; byCategory: Array<{ category: string; count: number }> } | null>(null);
  const [ticketStats, setTicketStats] = useState<{ total: number; open: number; inProgress: number; resolved: number; avgResolutionHours: number; byPriority: Array<{ priority: string; count: number }>; byCategory: Array<{ category: string; count: number }> } | null>(null);
  const [licenses, setLicenses] = useState<Array<{ id: string; softwareName: string; totalSeats: number; usedSeats: number; status: string; expiryDate: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [assetRes, ticketRes, licRes] = await Promise.allSettled([
        api.get("/ict/assets/stats"),
        api.get("/ict/tickets/stats"),
        api.get("/ict/licenses?limit=50"),
      ]);
      if (assetRes.status === "fulfilled") setAssetStats(assetRes.value.data.data);
      if (ticketRes.status === "fulfilled") setTicketStats(ticketRes.value.data.data);
      if (licRes.status === "fulfilled") setLicenses(licRes.value.data.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <PageWrapper title="ICT Administration" subtitle="Admin View"><LoadingSpinner /></PageWrapper>;

  const a = assetStats;
  const t = ticketStats;

  return (
    <PageWrapper title="ICT Administration" subtitle="Admin View — Asset oversight, ticket metrics, license management">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Assets" value={String(a?.total || 0)} icon={<Monitor size={20} />} />
        <StatCard title="Asset Value" value={formatCurrency(a?.totalValue || 0)} icon={<DollarSign size={20} />} />
        <StatCard title="Open Tickets" value={String(t?.open || 0)} icon={<Ticket size={20} />} />
        <StatCard title="Avg Resolution" value={`${t?.avgResolutionHours || 0}h`} icon={<AlertTriangle size={20} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Assets by Status</h3></CardHeader>
          <CardBody>
            {a?.byStatus && a.byStatus.length > 0 ? <DonutChartWidget data={a.byStatus.map((s) => ({ name: s.status, value: s.count }))} height={220} innerRadius={50} outerRadius={75} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Assets by Category</h3></CardHeader>
          <CardBody>
            {a?.byCategory && a.byCategory.length > 0 ? <BarChartWidget data={a.byCategory.map((c) => ({ name: c.category, count: c.count }))} bars={[{ key: "count", color: "#5B21B6" }]} xKey="name" height={220} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Tickets by Priority</h3></CardHeader>
          <CardBody>
            {t?.byPriority && t.byPriority.length > 0 ? <DonutChartWidget data={t.byPriority.map((p) => ({ name: p.priority, value: p.count }))} height={220} innerRadius={50} outerRadius={75} colors={["#DC2626", "#F97316", "#EAB308", "#3B82F6"]} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
          </CardBody>
        </Card>
      </div>

      {/* License Overview */}
      <Card>
        <CardHeader className="flex items-center gap-2">
          <Key size={16} className="text-[#5B21B6]" />
          <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Software License Overview</h3>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          {licenses.length === 0 ? <p className="text-xs text-[#9B93B8] text-center py-4">No licenses</p> : (
            <table className="w-full text-sm"><thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
              {["Software", "Used / Total", "Usage %", "Status", "Expiry"].map((h) => <th key={h} className="text-left px-4 py-2 text-xs font-medium text-[#9B93B8]">{h}</th>)}
            </tr></thead><tbody>
              {licenses.map((lic) => {
                const usage = lic.totalSeats > 0 ? Math.round((lic.usedSeats / lic.totalSeats) * 100) : 0;
                return (
                  <tr key={lic.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                    <td className="px-4 py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{lic.softwareName}</td>
                    <td className="px-4 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{lic.usedSeats} / {lic.totalSeats}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#EDE9FE] dark:bg-[#2D1F5E] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${usage > 90 ? "bg-red-500" : usage > 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${usage}%` }} />
                        </div>
                        <span className="text-xs">{usage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge variant={lic.status === "active" ? "success" : "default"}>{lic.status}</Badge></td>
                    <td className="px-4 py-3 text-xs text-[#9B93B8]">{lic.expiryDate ? new Date(lic.expiryDate).toLocaleDateString() : "Perpetual"}</td>
                  </tr>
                );
              })}
            </tbody></table>
          )}
        </CardBody>
      </Card>
    </PageWrapper>
  );
}
