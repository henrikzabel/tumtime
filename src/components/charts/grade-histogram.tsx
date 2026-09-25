"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { DistributionBin } from "@/lib/stats/distribution";

const PASS = "var(--chart-1)";
const FAIL = "var(--chart-fail)";

function HistogramTooltip({ active, payload }: { active?: boolean; payload?: { payload: DistributionBin }[] }) {
  if (!active || !payload?.length) return null;
  const bin = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="font-medium">Grade {bin.grade === "B" ? "B (passed)" : bin.grade === "N" ? "N (failed)" : bin.grade}</div>
      <div className="text-muted-foreground">
        {bin.count.toLocaleString("en-US")} students · {(bin.share * 100).toFixed(1)}%
      </div>
    </div>
  );
}

/** Grade distribution of one exam: passing grades in blue, failing grades in red. */
export function GradeHistogram({ bins, height = 220 }: { bins: DistributionBin[]; height?: number }) {
  if (bins.length === 0) return null;
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={bins} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="grade"
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            interval={0}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            width={48}
          />
          <Tooltip content={<HistogramTooltip />} cursor={{ fill: "var(--accent)", opacity: 0.6 }} />
          <Bar dataKey="count" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {bins.map((b) => (
              <Cell key={b.grade} fill={b.passing ? PASS : FAIL} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center justify-end gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: PASS }} /> Passed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: FAIL }} /> Failed
        </span>
      </div>
    </div>
  );
}
