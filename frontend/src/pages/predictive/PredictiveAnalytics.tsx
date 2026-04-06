import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner } from "../../components/ui/Card";
import { BarChartWidget, LineChartWidget, AreaChartWidget } from "../../components/charts/Charts";
import {
  Brain, Trophy, RefreshCw, TrendingUp, BarChart3,
  AlertTriangle, Building2, Activity, Target, Zap, Clock,
} from "lucide-react";
import { formatNumber, formatPercent } from "../../utils/formatters";
import api, { mlApi } from "../../api/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, AreaChart, Area, ResponsiveContainer, Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────

interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  auc_roc: number;
  training_time: number;
  cv_accuracy_mean?: number;
  cv_accuracy_std?: number;
  model_type?: string;
}

interface ConfusionMatrix {
  matrix: number[][];
  labels: string[];
  true_negatives: number;
  false_positives: number;
  false_negatives: number;
  true_positives: number;
}

interface FeatureImportance {
  features: string[];
  importances: number[];
  top_10: { feature: string; importance: number }[];
}

interface RocData {
  fpr: number[];
  tpr: number[];
  auc: number;
}

interface DepartmentRisk {
  name: string;
  total_employees: number;
  attrition_count: number;
  attrition_rate: number;
  risk_level: string;
  avg_satisfaction: number | null;
  avg_income: number;
}

interface ModelComparison {
  models: Record<string, {
    metrics: ModelMetrics;
    feature_importance: FeatureImportance;
    confusion_matrix: ConfusionMatrix;
    roc_data: RocData;
    is_trained: boolean;
  }>;
  best_model: string;
  best_accuracy: number;
  dataset_info: { total_rows: number; features_used: number };
  training_history: any[];
}

interface ForecastAccuracy {
  mape: number;
  rmse: number;
  mae: number;
  r_squared: number;
  interpretation: { mape_quality: string; r_squared_quality: string };
}

// ─── Theme constants ──────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  random_forest: "#5B21B6",
  gradient_boosting: "#059669",
  logistic_regression: "#D97706",
};

const MODEL_LABELS: Record<string, string> = {
  random_forest: "Random Forest",
  gradient_boosting: "LightGBM",
  logistic_regression: "Logistic Regression",
};

const RISK_COLORS: Record<string, string> = {
  high: "#DC2626",
  medium: "#D97706",
  low: "#059669",
};

const TOOLTIP_STYLE = {
  background: "#fff",
  border: "1px solid #E8E4F3",
  borderRadius: "10px",
  fontSize: "12px",
  boxShadow: "0 4px 12px rgba(91,33,182,0.1)",
};

const AXIS_TICK = { fontSize: 11, fill: "#9B93B8" };

// ─── Component ────────────────────────────────────────────────

export default function PredictiveAnalytics() {
  const [activeTab, setActiveTab] = useState<"models" | "forecasting" | "departments">("models");
  const [comparison, setComparison] = useState<ModelComparison | null>(null);
  const [departmentRisks, setDepartmentRisks] = useState<{ departments: DepartmentRisk[]; overall_attrition_rate: number } | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState("");
  const [forecastData, setForecastData] = useState<any>(null);
  const [forecastMetric, setForecastMetric] = useState("revenue");
  const [forecastHorizon, setForecastHorizon] = useState(90);
  const [forecastAccuracy, setForecastAccuracy] = useState<ForecastAccuracy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Data Loading ─────────────────────────────────────────

  const loadComparison = useCallback(async () => {
    try {
      let data;
      try {
        const res = await api.get("/predictive/attrition/models/comparison");
        data = res.data.data ?? res.data;
      } catch {
        const res = await mlApi.get("/predict/attrition/models/comparison");
        data = res.data;
      }
      setComparison(data);
    } catch {
      console.log("No trained models yet");
    }
  }, []);

  const loadDepartmentRisks = useCallback(async () => {
    try {
      let data;
      try {
        const res = await api.get("/predictive/attrition/department-risks");
        data = res.data.data ?? res.data;
      } catch {
        const res = await mlApi.get("/predict/attrition/department-risks");
        data = res.data;
      }
      setDepartmentRisks(data);
    } catch {
      console.log("No department risk data");
    }
  }, []);

  useEffect(() => {
    Promise.all([loadComparison(), loadDepartmentRisks()]).finally(() => setLoading(false));
  }, [loadComparison, loadDepartmentRisks]);

  // ─── Actions ──────────────────────────────────────────────

  const handleTrain = async () => {
    setIsTraining(true);
    setTrainingProgress("Training models on dataset...");
    setError(null);
    try {
      let data;
      try {
        const res = await api.post("/predictive/attrition/train");
        data = res.data.data ?? res.data;
      } catch {
        const res = await mlApi.post("/predict/attrition/train");
        data = res.data;
      }
      setTrainingProgress(`Training complete in ${data.training_time || ""}s!`);
      await loadComparison();
      await loadDepartmentRisks();
    } catch (err: any) {
      setError(`Training failed: ${err.message}`);
      setTrainingProgress("");
    } finally {
      setIsTraining(false);
    }
  };

  const handleForecast = async () => {
    try {
      setError(null);
      const sampleRes = await mlApi.get(`/predict/forecast/sample/${forecastMetric}`);
      const samplePoints = sampleRes.data.data?.data || sampleRes.data.data || sampleRes.data;

      const result = await mlApi.post("/predict/forecast", {
        metric: forecastMetric,
        historical_data: samplePoints,
        forecast_days: forecastHorizon,
      });

      setForecastData(result.data);
      if (result.data.accuracy_metrics) {
        setForecastAccuracy(result.data.accuracy_metrics);
      }
    } catch (err: any) {
      setError(`Forecast failed: ${err.message}`);
    }
  };

  // ─── Loading state ────────────────────────────────────────

  if (loading) {
    return (
      <PageWrapper title="Predictive Analytics" subtitle="ML-powered predictions">
        <LoadingSpinner />
      </PageWrapper>
    );
  }

  // ─── Sub-renders ──────────────────────────────────────────

  const renderMetricsCard = (name: string, metrics: ModelMetrics, isBest: boolean) => (
    <Card key={name} className={isBest ? "ring-2 ring-[#5B21B6]/30" : ""}>
      <CardBody>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MODEL_COLORS[name] }} />
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">
              {MODEL_LABELS[name] || name}
            </h3>
          </div>
          {isBest && <Badge variant="purple">Best Model</Badge>}
        </div>
        <p className="text-xs text-[#9B93B8] mb-4">Trained in {metrics.training_time}s</p>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Accuracy", value: metrics.accuracy },
            { label: "Precision", value: metrics.precision },
            { label: "Recall", value: metrics.recall },
            { label: "F1 Score", value: metrics.f1_score },
            { label: "AUC-ROC", value: metrics.auc_roc },
            { label: "CV Accuracy", value: metrics.cv_accuracy_mean },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-2 rounded-[10px] bg-[#F8F7FF] dark:bg-[#1E1B2E]">
              <p className="text-[10px] text-[#9B93B8] uppercase tracking-wide">{label}</p>
              <p className="text-lg font-bold text-[#1E1B2E] dark:text-[#EDE9FE] font-serif">
                {value ? `${(value * 100).toFixed(1)}%` : "N/A"}
              </p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );

  const renderConfusionMatrix = (cm: ConfusionMatrix, modelName: string) => (
    <Card key={`cm-${modelName}`}>
      <CardHeader>
        <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">
          Confusion Matrix — {MODEL_LABELS[modelName] || modelName}
        </h3>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-3 gap-1 max-w-xs mx-auto text-center">
          <div />
          <div className="text-[10px] font-semibold text-[#9B93B8] p-2">Pred: Stayed</div>
          <div className="text-[10px] font-semibold text-[#9B93B8] p-2">Pred: Left</div>

          <div className="text-[10px] font-semibold text-[#9B93B8] p-2 flex items-center">Actual: Stayed</div>
          <div className="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-[10px] font-bold text-emerald-700 dark:text-emerald-400 font-serif">
            {cm.true_negatives.toLocaleString()}
          </div>
          <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-[10px] font-bold text-red-700 dark:text-red-400 font-serif">
            {cm.false_positives.toLocaleString()}
          </div>

          <div className="text-[10px] font-semibold text-[#9B93B8] p-2 flex items-center">Actual: Left</div>
          <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-[10px] font-bold text-red-700 dark:text-red-400 font-serif">
            {cm.false_negatives.toLocaleString()}
          </div>
          <div className="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-[10px] font-bold text-emerald-700 dark:text-emerald-400 font-serif">
            {cm.true_positives.toLocaleString()}
          </div>
        </div>
      </CardBody>
    </Card>
  );

  const renderFeatureImportance = (fi: FeatureImportance, modelName: string) => {
    const data = fi.top_10.map((f) => ({
      feature: f.feature.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      importance: +(f.importance * 100).toFixed(1),
    })).reverse();

    return (
      <Card key={`fi-${modelName}`}>
        <CardHeader>
          <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">
            Top 10 Features — {MODEL_LABELS[modelName] || modelName}
          </h3>
        </CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F3" opacity={0.5} />
              <XAxis type="number" unit="%" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis dataKey="feature" type="category" tick={{ fontSize: 11, fill: "#9B93B8" }} width={110} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => `${value}%`} />
              <Bar dataKey="importance" fill={MODEL_COLORS[modelName] || "#5B21B6"} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    );
  };

  const renderROCCurve = () => {
    if (!comparison?.models) return null;

    const chartData: any[] = [];
    const modelNames = Object.keys(comparison.models).filter((m) => comparison.models[m].roc_data?.fpr);
    if (modelNames.length === 0) return null;

    const fprData = comparison.models[modelNames[0]].roc_data.fpr;
    for (let i = 0; i < fprData.length; i++) {
      const point: any = { fpr: fprData[i] };
      for (const name of modelNames) {
        const roc = comparison.models[name].roc_data;
        if (roc.tpr[i] !== undefined) point[name] = roc.tpr[i];
      }
      point.diagonal = fprData[i];
      chartData.push(point);
    }

    return (
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">ROC Curve Comparison</h3>
        </CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F3" opacity={0.5} />
              <XAxis dataKey="fpr" tick={AXIS_TICK} axisLine={false} tickLine={false} label={{ value: "False Positive Rate", position: "bottom", style: { fontSize: 11, fill: "#9B93B8" } }} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} label={{ value: "True Positive Rate", angle: -90, position: "left", style: { fontSize: 11, fill: "#9B93B8" } }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="diagonal" stroke="#E8E4F3" strokeDasharray="5 5" name="Random (0.5)" dot={false} />
              {modelNames.map((name) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={MODEL_COLORS[name]}
                  name={`${MODEL_LABELS[name]} (AUC: ${comparison.models[name].roc_data.auc.toFixed(3)})`}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    );
  };

  const renderDepartmentRisks = () => {
    if (!departmentRisks?.departments?.length) {
      return (
        <Card>
          <CardBody className="text-center py-16">
            <Building2 size={40} className="mx-auto mb-3 text-[#9B93B8]" />
            <p className="text-sm font-medium text-[#4C4566] dark:text-[#B8AEDD]">No department risk data available</p>
            <p className="text-xs text-[#9B93B8] mt-1">Train the attrition model first to generate department-level analysis.</p>
          </CardBody>
        </Card>
      );
    }

    const data = departmentRisks.departments.map((d) => ({
      ...d,
      attrition_pct: +(d.attrition_rate * 100).toFixed(1),
    }));

    return (
      <div className="space-y-6">
        {/* Overall rate */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Overall Attrition Rate"
            value={formatPercent(departmentRisks.overall_attrition_rate * 100)}
            icon={<Activity size={20} />}
          />
          <StatCard
            title="Departments Analyzed"
            value={formatNumber(data.length)}
            icon={<Building2 size={20} />}
          />
          <StatCard
            title="High Risk Departments"
            value={formatNumber(data.filter((d) => d.risk_level === "high").length)}
            icon={<AlertTriangle size={20} />}
          />
        </div>

        {/* Bar chart */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Attrition by Department / Job Role</h3>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F3" opacity={0.5} />
                <XAxis type="number" unit="%" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#9B93B8" }} width={75} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => `${value}%`} />
                <Bar dataKey="attrition_pct" name="Attrition Rate" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={index} fill={RISK_COLORS[entry.risk_level] || "#9B93B8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Department cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((dept) => (
            <Card key={dept.name}>
              <CardBody>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{dept.name}</h4>
                  <Badge variant={dept.risk_level === "high" ? "danger" : dept.risk_level === "medium" ? "warning" : "success"}>
                    {dept.risk_level.toUpperCase()}
                  </Badge>
                </div>
                <div className="space-y-1 text-xs text-[#9B93B8]">
                  <p>{dept.total_employees.toLocaleString()} employees &middot; {dept.attrition_count} left ({dept.attrition_pct}%)</p>
                  <p>Avg Income: ${dept.avg_income.toLocaleString()}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderForecastAccuracy = () => {
    if (!forecastAccuracy) return null;

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        {[
          { label: "MAPE", value: `${forecastAccuracy.mape}%`, quality: forecastAccuracy.interpretation.mape_quality },
          { label: "RMSE", value: forecastAccuracy.rmse },
          { label: "MAE", value: forecastAccuracy.mae },
          { label: "R\u00B2", value: forecastAccuracy.r_squared, quality: forecastAccuracy.interpretation.r_squared_quality },
        ].map(({ label, value, quality }) => (
          <Card key={label}>
            <CardBody className="text-center">
              <p className="text-[10px] text-[#9B93B8] uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-bold text-[#1E1B2E] dark:text-[#EDE9FE] font-serif">{value}</p>
              {quality && (
                <Badge variant={quality === "Excellent" ? "success" : quality === "Good" ? "info" : "warning"}>
                  {quality}
                </Badge>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    );
  };

  // ─── Tab config ───────────────────────────────────────────

  const tabs = [
    { key: "models" as const, label: "Models", icon: Brain },
    { key: "forecasting" as const, label: "Forecasting", icon: TrendingUp },
    { key: "departments" as const, label: "Departments", icon: Building2 },
  ];

  // ─── Main Render ──────────────────────────────────────────

  return (
    <PageWrapper title="Predictive Analytics" subtitle={`ML-powered predictions using ${comparison?.dataset_info?.total_rows?.toLocaleString() || "56,599"} employee records`}>
      {/* Train button + error */}
      <div className="flex items-center justify-between mb-6">
        <div />
        <button
          onClick={handleTrain}
          disabled={isTraining}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-sm font-semibold text-white transition-all ${
            isTraining
              ? "bg-[#9B93B8] cursor-not-allowed"
              : "bg-[#5B21B6] hover:bg-[#4C1D95] shadow-[0_2px_8px_rgba(91,33,182,0.3)]"
          }`}
        >
          <RefreshCw size={16} className={isTraining ? "animate-spin" : ""} />
          {isTraining ? "Training..." : "Train All Models"}
        </button>
      </div>

      {(trainingProgress || error) && (
        <div className={`mb-6 p-4 rounded-[12px] text-sm ${
          error
            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : "bg-[#EDE9FE] text-[#5B21B6] dark:bg-[#2D1F5E] dark:text-[#B8AEDD]"
        }`}>
          {error || trainingProgress}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#E8E4F3] dark:border-[#2E2850]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#5B21B6] text-[#5B21B6] dark:text-[#B8AEDD]"
                  : "border-transparent text-[#9B93B8] hover:text-[#4C4566]"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Models Tab ─────────────────────────────────────── */}
      {activeTab === "models" && (
        <div className="space-y-6">
          {comparison?.models && Object.keys(comparison.models).length > 0 ? (
            <>
              {/* Model cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(comparison.models).map(([name, model]) =>
                  renderMetricsCard(name, model.metrics, name === comparison.best_model)
                )}
              </div>

              {/* ROC Curve */}
              {renderROCCurve()}

              {/* Feature Importance + Confusion Matrices */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.entries(comparison.models).map(([name, model]) => (
                  <div key={name} className="contents">
                    {model.feature_importance?.top_10 && renderFeatureImportance(model.feature_importance, name)}
                    {model.confusion_matrix?.matrix && renderConfusionMatrix(model.confusion_matrix, name)}
                  </div>
                ))}
              </div>

              {/* Training history */}
              {comparison.training_history?.length > 0 && (
                <Card>
                  <CardHeader>
                    <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Training History</h3>
                  </CardHeader>
                  <CardBody>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-[#9B93B8] border-b border-[#E8E4F3] dark:border-[#2E2850]">
                            <th className="pb-2 font-medium">Date</th>
                            <th className="pb-2 font-medium">Dataset</th>
                            <th className="pb-2 font-medium">Features</th>
                            <th className="pb-2 font-medium">Duration</th>
                            <th className="pb-2 font-medium">Best Accuracy</th>
                          </tr>
                        </thead>
                        <tbody className="text-[#4C4566] dark:text-[#B8AEDD]">
                          {comparison.training_history.map((h: any, i: number) => (
                            <tr key={i} className="border-b border-[#E8E4F3]/50 dark:border-[#2E2850]/50">
                              <td className="py-2.5">{new Date(h.timestamp).toLocaleString()}</td>
                              <td className="py-2.5">{h.dataset_rows?.toLocaleString()} rows</td>
                              <td className="py-2.5">{h.features}</td>
                              <td className="py-2.5">{h.training_time_seconds}s</td>
                              <td className="py-2.5 font-semibold font-serif">
                                {Math.max(...Object.values(h.results || {}).map((r: any) => r.accuracy || 0) as number[]).toFixed(4)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardBody>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardBody className="text-center py-20">
                <Brain size={48} className="mx-auto mb-4 text-[#9B93B8]" />
                <p className="text-sm font-medium text-[#4C4566] dark:text-[#B8AEDD] mb-2">No Models Trained Yet</p>
                <p className="text-xs text-[#9B93B8] mb-6 max-w-md mx-auto">
                  Click "Train All Models" to train Random Forest, LightGBM, and Logistic Regression on 56,599 employee records.
                </p>
                <button
                  onClick={handleTrain}
                  disabled={isTraining}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-sm font-semibold text-white bg-[#5B21B6] hover:bg-[#4C1D95] transition-colors"
                >
                  <RefreshCw size={16} className={isTraining ? "animate-spin" : ""} />
                  {isTraining ? "Training..." : "Start Training"}
                </button>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* ── Forecasting Tab ────────────────────────────────── */}
      {activeTab === "forecasting" && (
        <div className="space-y-6">
          <Card>
            <CardBody>
              <div className="flex gap-4 items-end flex-wrap">
                <div>
                  <label className="block text-xs font-medium text-[#9B93B8] mb-1">Metric</label>
                  <select
                    value={forecastMetric}
                    onChange={(e) => setForecastMetric(e.target.value)}
                    className="px-3 py-2 text-sm rounded-[10px] border border-[#E8E4F3] dark:border-[#2E2850] bg-white dark:bg-[#16122E] text-[#1E1B2E] dark:text-[#EDE9FE] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30"
                  >
                    <option value="revenue">Revenue</option>
                    <option value="headcount">Headcount</option>
                    <option value="budget_utilization">Budget Utilization</option>
                    <option value="project_completion">Project Completion</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9B93B8] mb-1">Horizon</label>
                  <select
                    value={forecastHorizon}
                    onChange={(e) => setForecastHorizon(Number(e.target.value))}
                    className="px-3 py-2 text-sm rounded-[10px] border border-[#E8E4F3] dark:border-[#2E2850] bg-white dark:bg-[#16122E] text-[#1E1B2E] dark:text-[#EDE9FE] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30"
                  >
                    <option value={30}>30 Days</option>
                    <option value={60}>60 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={180}>180 Days</option>
                  </select>
                </div>
                <button
                  onClick={handleForecast}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-[10px] text-sm font-semibold text-white bg-[#5B21B6] hover:bg-[#4C1D95] transition-colors"
                >
                  <TrendingUp size={15} />
                  Generate Forecast
                </button>
              </div>
            </CardBody>
          </Card>

          {renderForecastAccuracy()}

          {forecastData?.forecast && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">
                  {forecastMetric.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} — {forecastHorizon}-Day Forecast
                </h3>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={forecastData.forecast}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F3" opacity={0.5} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9B93B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Area type="monotone" dataKey="upper_bound" stroke="none" fill="#5B21B6" fillOpacity={0.08} name="Upper Bound" />
                    <Area type="monotone" dataKey="lower_bound" stroke="none" fill="#5B21B6" fillOpacity={0.08} name="Lower Bound" />
                    <Area type="monotone" dataKey="predicted" stroke="#5B21B6" strokeWidth={2} fill="#5B21B6" fillOpacity={0.15} name="Forecast" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          )}

          {!forecastData && (
            <Card>
              <CardBody className="text-center py-16">
                <TrendingUp size={40} className="mx-auto mb-3 text-[#9B93B8]" />
                <p className="text-sm font-medium text-[#4C4566] dark:text-[#B8AEDD]">Select a metric and generate a forecast</p>
                <p className="text-xs text-[#9B93B8] mt-1">Uses Prophet or linear regression to forecast 30-180 days ahead.</p>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* ── Departments Tab ────────────────────────────────── */}
      {activeTab === "departments" && renderDepartmentRisks()}
    </PageWrapper>
  );
}
