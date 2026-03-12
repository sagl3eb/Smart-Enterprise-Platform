import {
  LineChart as RechartsLine, Line, AreaChart, Area,
  BarChart as RechartsBar, Bar,
  PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COLORS = ["#5B21B6", "#7C3AED", "#B45309", "#D97706", "#059669", "#0891B2", "#DC2626", "#6366F1"];

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
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLine data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F3" opacity={0.5} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "1px solid #E8E4F3",
            borderRadius: "10px",
            fontSize: "12px",
            boxShadow: "0 4px 12px rgba(91,33,182,0.1)",
          }}
        />
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
  );
}

// ─── Area Chart ────────────────────────────────────────────

interface AreaChartProps extends ChartProps {
  areas: Array<{ key: string; color?: string }>;
  xKey?: string;
}

export function AreaChartWidget({ data, areas, xKey = "name", height = 300 }: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F3" opacity={0.5} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E8E4F3", borderRadius: "10px", fontSize: "12px" }} />
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
  );
}

// ─── Bar Chart ─────────────────────────────────────────────

interface BarChartProps extends ChartProps {
  bars: Array<{ key: string; color?: string; stackId?: string }>;
  xKey?: string;
  layout?: "horizontal" | "vertical";
}

export function BarChartWidget({ data, bars, xKey = "name", height = 300, layout = "horizontal" }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBar data={data} layout={layout === "vertical" ? "vertical" : "horizontal"} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F3" opacity={0.5} />
        {layout === "vertical" ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} />
            <YAxis dataKey={xKey} type="category" tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} width={100} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9B93B8" }} axisLine={false} tickLine={false} />
          </>
        )}
        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E8E4F3", borderRadius: "10px", fontSize: "12px" }} />
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
  const chartColors = colors || COLORS;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPie>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
          style={{ fontSize: "11px" }}
        >
          {data.map((_, i) => (
            <Cell key={`cell-${i}`} fill={chartColors[i % chartColors.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E8E4F3", borderRadius: "10px", fontSize: "12px" }} />
      </RechartsPie>
    </ResponsiveContainer>
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
    <ResponsiveContainer width={width} height={height}>
      <RechartsLine data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </RechartsLine>
    </ResponsiveContainer>
  );
}
