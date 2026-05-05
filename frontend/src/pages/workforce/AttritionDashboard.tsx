import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner } from "../../components/ui/Card";
import { BarChartWidget, DonutChartWidget } from "../../components/charts/Charts";
import { AlertTriangle, Users, TrendingDown, ShieldAlert } from "lucide-react";
import { formatNumber, formatPercent } from "../../utils/formatters";
import api from "../../api/client";

interface AttritionSummary {
  totalEmployees: number;
  totalPredictions: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  avgRiskScore: number;
  departmentBreakdown: Array<{
    department: string;
    high: number;
    medium: number;
    low: number;
    avgRiskScore: number;
    total: number;
  }>;
  topFactors: Array<{ factor: string; totalImportance: number }>;
}

export default function AttritionDashboard() {
  const [summary, setSummary] = useState<AttritionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/workforce/attrition/summary");
      setSummary(res.data.data);
    } catch {
      setSummary({
        totalEmployees: 0, totalPredictions: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0,
        avgRiskScore: 0,
        departmentBreakdown: [],
        topFactors: [],
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !summary) {
    return <PageWrapper title="Attrition Risk Dashboard" subtitle="Workforce Analytics"><LoadingSpinner /></PageWrapper>;
  }

  const riskDonut = [
    { name: "High Risk", value: summary.highRisk },
    { name: "Medium Risk", value: summary.mediumRisk },
    { name: "Low Risk", value: summary.lowRisk },
  ];

  const deptData = summary.departmentBreakdown.map((d) => ({
    name: d.department,
    high: d.high,
    medium: d.medium,
    low: d.low,
  }));

  const factorNames: Record<string, string> = {
    satisfaction_score: "Job Satisfaction",
    performance_score: "Performance",
    years_at_company: "Tenure",
    overtime_hours_avg: "Overtime Hours",
    num_projects: "Project Load",
    salary: "Salary Level",
    days_since_last_promotion: "Promotion Wait",
  };

  return (
    <PageWrapper title="Attrition Risk Dashboard" subtitle="Workforce Analytics">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Employees" value={formatNumber(summary.totalEmployees)} icon={<Users size={20} />} />
        <StatCard title="High Risk" value={formatNumber(summary.highRisk)} subtitle="employees" icon={<AlertTriangle size={20} />} />
        <StatCard title="Medium Risk" value={formatNumber(summary.mediumRisk)} icon={<ShieldAlert size={20} />} />
        <StatCard title="Avg Risk Score" value={formatPercent(summary.avgRiskScore * 100)} icon={<TrendingDown size={20} />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Risk Distribution</h3>
          </CardHeader>
          <CardBody>
            <DonutChartWidget data={riskDonut} colors={["#DC2626", "#D97706", "#059669"]} height={250} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Risk by Department</h3>
          </CardHeader>
          <CardBody>
            <BarChartWidget
              data={deptData}
              bars={[
                { key: "high", color: "#DC2626", stackId: "risk" },
                { key: "medium", color: "#D97706", stackId: "risk" },
                { key: "low", color: "#059669", stackId: "risk" },
              ]}
              xKey="name"
              height={250}
            />
          </CardBody>
        </Card>
      </div>

      {/* Top Factors + High Risk List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Top Attrition Factors</h3>
            <p className="text-xs text-[#9B93B8]">Feature importance from ML model</p>
          </CardHeader>
          <CardBody className="space-y-3">
            {summary.topFactors.map((factor, i) => {
              const maxImportance = summary.topFactors[0]?.totalImportance || 1;
              const pct = (factor.totalImportance / maxImportance) * 100;
              return (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-[#4C4566] dark:text-[#B8AEDD]">
                      {factorNames[factor.factor] || factor.factor}
                    </span>
                    <span className="text-xs text-[#9B93B8]">{factor.totalImportance.toFixed(1)}</span>
                  </div>
                  <div className="h-2 bg-[#EDE9FE] dark:bg-[#2D1F5E] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#5B21B6]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Department Comparison</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              {summary.departmentBreakdown
                .sort((a, b) => b.avgRiskScore - a.avgRiskScore)
                .map((dept) => (
                  <div key={dept.department} className="flex items-center justify-between py-2 border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                    <div>
                      <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{dept.department}</p>
                      <p className="text-xs text-[#9B93B8]">{dept.total} employees</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={dept.avgRiskScore > 0.4 ? "danger" : dept.avgRiskScore > 0.3 ? "warning" : "success"}>
                        {formatPercent(dept.avgRiskScore * 100)}
                      </Badge>
                      {dept.high > 0 && (
                        <span className="text-[10px] text-red-500 font-medium">{dept.high} high</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  );
}
