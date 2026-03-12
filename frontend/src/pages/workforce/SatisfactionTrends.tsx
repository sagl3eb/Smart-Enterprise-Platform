import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, LoadingSpinner } from "../../components/ui/Card";
import { LineChartWidget, BarChartWidget } from "../../components/charts/Charts";
import api from "../../api/client";

interface TrendPoint {
  month: string;
  avgSatisfaction: number | null;
  avgPerformance: number | null;
  avgTurnover: number | null;
}

interface DeptComparison {
  department: string;
  headcount: number;
  avgSatisfaction: number;
  avgPerformance: number;
  turnoverRate: number;
  avgAttritionRisk: number;
  highRiskEmployees: number;
  overtimeHours: number;
}

export default function SatisfactionTrends() {
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [deptComparison, setDeptComparison] = useState<DeptComparison[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trendsRes, deptRes] = await Promise.allSettled([
        api.get("/workforce/satisfaction-trends?months=12"),
        api.get("/workforce/department-comparison"),
      ]);

      if (trendsRes.status === "fulfilled") setTrends(trendsRes.value.data.data || []);
      if (deptRes.status === "fulfilled") setDeptComparison(deptRes.value.data.data || []);
    } catch {
      // Fallback data
      setTrends([
        { month: "2024-07", avgSatisfaction: 3.8, avgPerformance: 3.6, avgTurnover: 8.2 },
        { month: "2024-08", avgSatisfaction: 3.9, avgPerformance: 3.7, avgTurnover: 7.8 },
        { month: "2024-09", avgSatisfaction: 3.7, avgPerformance: 3.8, avgTurnover: 9.1 },
        { month: "2024-10", avgSatisfaction: 4.0, avgPerformance: 3.9, avgTurnover: 7.5 },
        { month: "2024-11", avgSatisfaction: 4.1, avgPerformance: 3.8, avgTurnover: 6.9 },
        { month: "2024-12", avgSatisfaction: 3.9, avgPerformance: 4.0, avgTurnover: 7.2 },
      ]);
      setDeptComparison([
        { department: "Engineering", headcount: 14, avgSatisfaction: 4.1, avgPerformance: 4.0, turnoverRate: 5.2, avgAttritionRisk: 0.28, highRiskEmployees: 2, overtimeHours: 120 },
        { department: "Sales", headcount: 10, avgSatisfaction: 3.6, avgPerformance: 3.8, turnoverRate: 12.5, avgAttritionRisk: 0.42, highRiskEmployees: 3, overtimeHours: 85 },
        { department: "Marketing", headcount: 8, avgSatisfaction: 4.0, avgPerformance: 3.9, turnoverRate: 7.0, avgAttritionRisk: 0.31, highRiskEmployees: 1, overtimeHours: 40 },
        { department: "HR", headcount: 5, avgSatisfaction: 4.3, avgPerformance: 4.1, turnoverRate: 4.0, avgAttritionRisk: 0.20, highRiskEmployees: 0, overtimeHours: 25 },
        { department: "Finance", headcount: 6, avgSatisfaction: 3.9, avgPerformance: 3.7, turnoverRate: 8.5, avgAttritionRisk: 0.35, highRiskEmployees: 1, overtimeHours: 50 },
        { department: "Operations", headcount: 5, avgSatisfaction: 3.7, avgPerformance: 3.5, turnoverRate: 6.0, avgAttritionRisk: 0.25, highRiskEmployees: 0, overtimeHours: 60 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageWrapper title="Satisfaction Trends" subtitle="Workforce Analytics"><LoadingSpinner /></PageWrapper>;
  }

  const trendData = trends.map((t) => ({
    month: t.month.slice(5),
    Satisfaction: t.avgSatisfaction || 0,
    Performance: t.avgPerformance || 0,
    "Turnover %": t.avgTurnover || 0,
  }));

  const deptSatisfaction = deptComparison.map((d) => ({
    name: d.department,
    satisfaction: d.avgSatisfaction,
    performance: d.avgPerformance,
  }));

  const deptOvertime = deptComparison.map((d) => ({
    name: d.department,
    overtime: d.overtimeHours,
    headcount: d.headcount,
  }));

  return (
    <PageWrapper title="Satisfaction Trends" subtitle="Workforce Analytics — Satisfaction & Performance over time">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Monthly Trends</h3>
            <p className="text-xs text-[#9B93B8]">Satisfaction, Performance & Turnover</p>
          </CardHeader>
          <CardBody>
            <LineChartWidget
              data={trendData}
              lines={[
                { key: "Satisfaction", color: "#5B21B6" },
                { key: "Performance", color: "#059669" },
                { key: "Turnover %", color: "#DC2626", dashed: true },
              ]}
              xKey="month"
              height={320}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Satisfaction by Department</h3>
          </CardHeader>
          <CardBody>
            <BarChartWidget
              data={deptSatisfaction}
              bars={[
                { key: "satisfaction", color: "#5B21B6" },
                { key: "performance", color: "#7C3AED" },
              ]}
              xKey="name"
              height={280}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Overtime by Department</h3>
          </CardHeader>
          <CardBody>
            <BarChartWidget
              data={deptOvertime}
              bars={[
                { key: "overtime", color: "#D97706" },
                { key: "headcount", color: "#5B21B6" },
              ]}
              xKey="name"
              height={280}
            />
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  );
}
