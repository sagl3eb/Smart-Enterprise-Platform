import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner } from "../../components/ui/Card";
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

export default function Dashboard() {
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [kpis, setKpis] = useState<KpiCard[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryRes, kpiRes, alertRes] = await Promise.allSettled([
        api.get("/dashboard/summary"),
        api.get("/dashboard/kpis/latest"),
        api.get("/alerts?limit=5&isRead=false"),
      ]);

      if (summaryRes.status === "fulfilled") setSummary(summaryRes.value.data.data);
      if (kpiRes.status === "fulfilled") setKpis(kpiRes.value.data.data || []);
      if (alertRes.status === "fulfilled") setRecentAlerts(alertRes.value.data.data || []);
    } catch {
      // Use placeholder data if API not available
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
    hr: { activeEmployees: 48, departments: 6, pendingLeaves: 5 },
    finance: { ytdTransactions: 1240, ytdAmount: 2450000, budgetAllocated: 5000000, budgetSpent: 3200000 },
    ict: { openTickets: 23 },
    construction: { activeProjects: 8 },
    workforce: { highRiskEmployees: 7 },
    alerts: { unread: 12 },
  };

  const budgetUtilization = s.finance.budgetAllocated > 0
    ? Math.round((s.finance.budgetSpent / s.finance.budgetAllocated) * 100)
    : 0;

  const deptChartData = [
    { name: "Engineering", employees: 14, satisfaction: 4.1 },
    { name: "Sales", employees: 10, satisfaction: 3.6 },
    { name: "Marketing", employees: 8, satisfaction: 4.0 },
    { name: "HR", employees: 5, satisfaction: 4.3 },
    { name: "Finance", employees: 6, satisfaction: 3.9 },
    { name: "Operations", employees: 5, satisfaction: 3.7 },
  ];

  const monthlyRevenue = [
    { month: "Jul", revenue: 185000, expenses: 142000 },
    { month: "Aug", revenue: 198000, expenses: 148000 },
    { month: "Sep", revenue: 210000, expenses: 155000 },
    { month: "Oct", revenue: 195000, expenses: 151000 },
    { month: "Nov", revenue: 225000, expenses: 160000 },
    { month: "Dec", revenue: 240000, expenses: 168000 },
  ];

  const ticketsByStatus = [
    { name: "Open", value: 12 },
    { name: "In Progress", value: 8 },
    { name: "Resolved", value: 45 },
    { name: "Closed", value: 120 },
  ];

  return (
    <PageWrapper title="Executive Dashboard" subtitle="Cross-module overview">
      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Active Employees"
          value={formatNumber(s.hr.activeEmployees)}
          change={2.4}
          subtitle="vs last month"
          icon={<Users size={20} />}
        />
        <StatCard
          title="YTD Revenue"
          value={formatCurrency(s.finance.ytdAmount)}
          change={8.2}
          subtitle="vs last year"
          icon={<DollarSign size={20} />}
        />
        <StatCard
          title="Open IT Tickets"
          value={formatNumber(s.ict.openTickets)}
          change={-12.5}
          subtitle="vs last week"
          icon={<Monitor size={20} />}
        />
        <StatCard
          title="Active Projects"
          value={formatNumber(s.construction.activeProjects)}
          change={0}
          subtitle="no change"
          icon={<HardHat size={20} />}
        />
      </div>

      {/* Second Row: Budget + Alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Budget Utilization"
          value={`${budgetUtilization}%`}
          change={budgetUtilization > 80 ? 5.2 : -3.1}
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
        <Card className="lg:col-span-2">
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
              height={260}
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
