"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type TrendPoint = { label: string; endterm?: number | null; retake?: number | null };

const FORMATS = {
  grade: (v: number) => v.toFixed(1),
  percent: (v: number) => `${Math.round(v * 100)}%`,
};

const SERIES = [
  { key: "endterm", name: "Endterm", color: "var(--chart-1)" },
  { key: "retake", name: "Retake", color: "var(--chart-2)" },
] as const;

type TooltipProps = {
  active?: boolean;
  label?: string;
  payload?: { dataKey: string; value: number; color: string; name: string }[];
  format: (v: number) => string;
};

function TrendTooltip({ active, label, payload, format }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="mb-1 font-medium">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium text-foreground">{format(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** One metric over semesters, endterm and retake as separate lines (single y-axis). */
export function TrendChart({
  data,
  metric,
  domain,
  reversed = false,
  height = 220,
}: {
  data: TrendPoint[];
  metric: keyof typeof FORMATS;
  domain?: [number, number];
  /** Draw better values higher (for grades, where lower is better). */
  reversed?: boolean;
  height?: number;
}) {
  const format = FORMATS[metric];
  const present = SERIES.filter((s) => data.some((d) => d[s.key] !== null && d[s.key] !== undefined));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          minTickGap={16}
        />
        <YAxis
          domain={domain ?? ["auto", "auto"]}
          reversed={reversed}
          tickFormatter={format}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          width={52}
        />
        <Tooltip content={<TrendTooltip format={format} />} cursor={{ stroke: "var(--border)" }} />
        {present.length > 1 && (
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value: string) => <span style={{ color: "var(--muted-foreground)" }}>{value}</span>}
          />
        )}
        {present.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 4, fill: s.color, stroke: "var(--card)", strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: "var(--card)", strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
