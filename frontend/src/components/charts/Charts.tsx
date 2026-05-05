import {
  LineChart as RechartsLine, Line, AreaChart, Area,
  BarChart as RechartsBar, Bar,
  PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COLORS = ["#5B21B6", "#7C3AED", "#B45309", "#D97706", "#059669", "#0891B2", "#DC2626", "#6366F1"];

// Compact number formatter — turns 12345.67 into "$12.3k", drops trailing decimals.
function formatCompactNumber(value: number, currency = false): string {
  if (typeof value !== "number" || !isFinite(value)) return String(value ?? "");
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const prefix = currency ? "$" : "";
  if (abs >= 1_000_000) return `${sign}${prefix}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${sign}${prefix}${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${sign}${prefix}${Math.round(abs)}`;
}

const tooltipCurrencyFormatter = (v: number | string) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : String(v);
};

const tooltipStyle = {
  background: "var(--chart-tooltip-bg, #fff)",
  border: "1px solid var(--chart-tooltip-border, #E8E4F3)",
  borderRadius: "10px",
  fontSize: "12px",
  color: "var(--chart-tooltip-fg, #1E1B2E)",
  boxShadow: "0 4px 12px rgba(91,33,182,0.1)",
};

function ChartEmpty({ height }: { height: number }) {
  return (
    <div
      style={{ width: "100%", height }}
      className="flex flex-col items-center justify-center text-center rounded-[10px]
        border border-dashed border-[#E8E4F3] dark:border-[#2E2850]
        text-[#9B93B8] dark:text-[#6B5F8F] text-xs"
    >
      <p className="font-medium text-[#4C4566] dark:text-[#B8AEDD]">No data to display</p>
      <p className="mt-0.5">This organization has no records yet.</p>
    </div>
  );
}

interface ChartProps {
  data: Record<string, unknown>[];
  height?: number;
}

// ─── Line Chart ────────────────────────────────────────────

interface LineChartProps extends ChartProps {
  lines: Array<{ key: string; color?: string; dashed?: boolean }>;
  xKey?: string;
}

export function LineChartWidget({ data, lines, xKey = "name", height = 300 }: LineChartProps) {
  if (!data || data.length === 0) return <ChartEmpty height={height} />;
  return (
    <div style={{ width: "100%", height }}>
    <ResponsiveContainer width="100%" height="100%">
      <RechartsLine data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F3" opacity={0.5} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        {lines.map((line, i) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            stroke={line.color || COLORS[i % COLORS.length]}
            strokeWidth={2}
            strokeDasharray={line.dashed ? "5 5" : undefined}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </RechartsLine>
    </ResponsiveContainer>
    </div>
  );
}

// ─── Area Chart ────────────────────────────────────────────

interface AreaChartProps extends ChartProps {
  areas: Array<{ key: string; color?: string }>;
  xKey?: string;
  currency?: boolean;
}

export function AreaChartWidget({ data, areas, xKey = "name", height = 300, currency = false }: AreaChartProps) {
  if (!data || data.length === 0) return <ChartEmpty height={height} />;
  return (
    <div style={{ width: "100%", height }}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F3" opacity={0.5} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCompactNumber(v, currency)} />
        <Tooltip contentStyle={tooltipStyle} formatter={currency ? tooltipCurrencyFormatter : undefined} />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        {areas.map((area, i) => (
          <Area
            key={area.key}
            type="monotone"
            dataKey={area.key}
            stroke={area.color || COLORS[i % COLORS.length]}
            fill={area.color || COLORS[i % COLORS.length]}
            fillOpacity={0.1}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
    </div>
  );
}

// ─── Bar Chart ─────────────────────────────────────────────

interface BarChartProps extends ChartProps {
  bars: Array<{ key: string; color?: string; stackId?: string }>;
  xKey?: string;
  layout?: "horizontal" | "vertical";
  currency?: boolean;
}

export function BarChartWidget({ data, bars, xKey = "name", height = 300, layout = "horizontal", currency = false }: BarChartProps) {
  if (!data || data.length === 0) return <ChartEmpty height={height} />;
  const numFormatter = (v: number) => formatCompactNumber(v, currency);
  return (
    <div style={{ width: "100%", height }}>
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBar data={data} layout={layout === "vertical" ? "vertical" : "horizontal"} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F3" opacity={0.5} />
        {layout === "vertical" ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} tickFormatter={numFormatter} />
            <YAxis dataKey={xKey} type="category" tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} width={100} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} tickFormatter={numFormatter} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} formatter={currency ? tooltipCurrencyFormatter : undefined} />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        {bars.map((bar, i) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            fill={bar.color || COLORS[i % COLORS.length]}
            radius={[4, 4, 0, 0]}
            stackId={bar.stackId}
          />
        ))}
      </RechartsBar>
    </ResponsiveContainer>
    </div>
  );
}

// ─── Donut Chart ───────────────────────────────────────────

interface DonutChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  colors?: string[];
}

export function DonutChartWidget({ data, height = 250, innerRadius = 60, outerRadius = 90, colors }: DonutChartProps) {
  if (!data || data.length === 0 || data.every((d) => !d.value)) return <ChartEmpty height={height} />;
  const chartColors = colors || COLORS;
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPie>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => {
              const pct = ((percent ?? 0) * 100);
              if (pct < 5) return "";
              const n = String(name ?? "");
              return `${n.length > 10 ? n.slice(0, 10) + "…" : n} ${pct.toFixed(0)}%`;
            }}
            labelLine={false}
            style={{ fontSize: "10px" }}
          >
            {data.map((_, i) => (
              <Cell key={`cell-${i}`} fill={chartColors[i % chartColors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
        </RechartsPie>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Mini Sparkline ────────────────────────────────────────

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ data, color = "#5B21B6", width = 80, height = 30 }: SparklineProps) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLine data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
        </RechartsLine>
      </ResponsiveContainer>
    </div>
  );
}
