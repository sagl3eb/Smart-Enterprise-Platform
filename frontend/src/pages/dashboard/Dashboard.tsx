import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner } from "../../components/ui/Card";
import { Toast } from "../../components/ui/Modal";
import { BarChartWidget, DonutChartWidget, AreaChartWidget, Sparkline } from "../../components/charts/Charts";
import { Users, DollarSign, Monitor, HardHat, AlertTriangle, Bell, TrendingUp, Activity } from "lucide-react";
import { formatCurrency, formatNumber, formatRelativeTime } from "../../utils/formatters";
import api from "../../api/client";
import type { KpiCard, Alert } from "../../types";

interface ExecutiveSummary {
  hr: { activeEmployees: number; departments: number; pendingLeaves: number };
  finance: { ytdTransactions: number; ytdAmount: number; budgetAllocated: number; budgetSpent: number };
  ict: { openTickets: number };
  construction: { activeProjects: number };
  workforce: { highRiskEmployees: number };
  alerts: { unread: number };
}

interface DashboardCharts {
  monthlyRevenue: Array<{ month: string; revenue: number; expenses: number }>;
  ticketsByStatus: Array<{ name: string; value: number }>;
  deptChartData: Array<{ name: string; employees: number; satisfaction: number }>;
}

export default function Dashboard() {
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [kpis, setKpis] = useState<KpiCard[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [charts, setCharts] = useState<DashboardCharts>({
    monthlyRevenue: [],
    ticketsByStatus: [],
    deptChartData: [],
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryRes, kpiRes, alertRes, chartsRes] = await Promise.allSettled([
        api.get("/dashboard/summary"),
        api.get("/dashboard/kpis/latest"),
        api.get("/alerts?limit=5&isRead=false"),
        api.get("/dashboard/charts"),
      ]);

      if (summaryRes.status === "fulfilled") setSummary(summaryRes.value.data.data);
      if (kpiRes.status === "fulfilled") setKpis(kpiRes.value.data.data || []);
      if (alertRes.status === "fulfilled") setRecentAlerts(alertRes.value.data.data || []);
      if (chartsRes.status === "fulfilled" && chartsRes.value.data.data) {
        setCharts(chartsRes.value.data.data);
      }
    } catch {
      // Leave state empty; render shows zeros
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageWrapper title="Executive Dashboard" subtitle="Cross-module overview">
        <LoadingSpinner />
      </PageWrapper>
    );
  }

  const s = summary || {
    hr: { activeEmployees: 0, departments: 0, pendingLeaves: 0 },
    finance: { ytdTransactions: 0, ytdAmount: 0, budgetAllocated: 0, budgetSpent: 0 },
    ict: { openTickets: 0 },
    construction: { activeProjects: 0 },
    workforce: { highRiskEmployees: 0 },
    alerts: { unread: 0 },
  };

  const budgetUtilization = s.finance.budgetAllocated > 0
    ? Math.round((s.finance.budgetSpent / s.finance.budgetAllocated) * 100)
    : 0;

  const { deptChartData, monthlyRevenue, ticketsByStatus } = charts;

  return (
    <PageWrapper title="Executive Dashboard" subtitle="Cross-module overview">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Active Employees"
          value={formatNumber(s.hr.activeEmployees)}
          subtitle={`${s.hr.departments} departments`}
          icon={<Users size={20} />}
        />
        <StatCard
          title="YTD Revenue"
          value={formatCurrency(s.finance.ytdAmount)}
          subtitle={`${formatNumber(s.finance.ytdTransactions)} transactions`}
          icon={<DollarSign size={20} />}
        />
        <StatCard
          title="Open IT Tickets"
          value={formatNumber(s.ict.openTickets)}
          subtitle="currently open"
          icon={<Monitor size={20} />}
        />
        <StatCard
          title="Active Projects"
          value={formatNumber(s.construction.activeProjects)}
          subtitle="in progress"
          icon={<HardHat size={20} />}
        />
      </div>

      {/* Second Row: Budget + Alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Budget Utilization"
          value={`${budgetUtilization}%`}
          subtitle="of allocated"
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          title="Pending Leaves"
          value={formatNumber(s.hr.pendingLeaves)}
          subtitle="awaiting approval"
          icon={<Activity size={20} />}
        />
        <StatCard
          title="High Risk Employees"
          value={formatNumber(s.workforce.highRiskEmployees)}
          subtitle="attrition risk"
          icon={<AlertTriangle size={20} />}
        />
        <StatCard
          title="Unread Alerts"
          value={formatNumber(s.alerts.unread)}
          subtitle="action required"
          icon={<Bell size={20} />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue vs Expenses */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Revenue vs Expenses</h3>
            <p className="text-xs text-[#9B93B8]">Last 6 months</p>
          </CardHeader>
          <CardBody>
            <AreaChartWidget
              data={monthlyRevenue}
              areas={[
                { key: "revenue", color: "#5B21B6" },
                { key: "expenses", color: "#D97706" },
              ]}
              xKey="month"
              height={280}
              currency
            />
          </CardBody>
        </Card>

        {/* IT Tickets Donut */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">IT Tickets</h3>
            <p className="text-xs text-[#9B93B8]">By status</p>
          </CardHeader>
          <CardBody>
            <DonutChartWidget data={ticketsByStatus} height={280} />
          </CardBody>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Breakdown */}
        <Card className="lg:col-span-2 self-start">
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Department Overview</h3>
            <p className="text-xs text-[#9B93B8]">Headcount & satisfaction</p>
          </CardHeader>
          <CardBody>
            <BarChartWidget
              data={deptChartData}
              bars={[
                { key: "employees", color: "#5B21B6" },
                { key: "satisfaction", color: "#7C3AED" },
              ]}
              xKey="name"
              height={300}
            />
          </CardBody>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Recent Alerts</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            {recentAlerts.length > 0 ? recentAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 pb-3 border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 last:pb-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  alert.severity === "critical" ? "bg-red-500" :
                  alert.severity === "high" ? "bg-orange-500" :
                  alert.severity === "medium" ? "bg-yellow-500" : "bg-blue-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#1E1B2E] dark:text-[#EDE9FE] truncate">{alert.title}</p>
                  <p className="text-[10px] text-[#9B93B8] mt-0.5">{formatRelativeTime(alert.createdAt)}</p>
                </div>
                <Badge variant={alert.severity === "critical" || alert.severity === "high" ? "danger" : "warning"}>
                  {alert.severity}
                </Badge>
              </div>
            )) : (
              <div className="text-center py-8">
                <p className="text-xs text-[#9B93B8]">No recent alerts</p>
              </div>
            )}

            {/* KPI Sparklines */}
            {kpis.slice(0, 4).map((kpi) => (
              <div key={kpi.id} className="flex items-center justify-between py-2 border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                <div>
                  <p className="text-xs font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{kpi.name}</p>
                  <p className="text-lg font-bold font-serif text-[#5B21B6]">{kpi.currentValue}</p>
                </div>
                {kpi.sparkline.length > 1 && (
                  <Sparkline data={kpi.sparkline} color={kpi.change >= 0 ? "#059669" : "#DC2626"} />
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

    </PageWrapper>
  );
}
