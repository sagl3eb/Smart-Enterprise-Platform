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

      const trendsData = trendsRes.status === "fulfilled" ? (trendsRes.value.data.data || []) : [];
      const deptData = deptRes.status === "fulfilled" ? (deptRes.value.data.data || []) : [];
      setTrends(trendsData);
      setDeptComparison(deptData);
    } catch {
      setTrends([]);
      setDeptComparison([]);
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
    <PageWrapper title="Satisfaction Trends" subtitle="Workforce Analytics - Satisfaction & Performance over time">
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
