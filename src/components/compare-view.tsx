"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ModuleSearch } from "@/components/module-search";
import { Card, CardContent } from "@/components/ui/card";
import { MAX_COMPARE, serializeCompare, type CompareItem } from "@/lib/compare";
import { formatAverage, formatCount, formatPercent } from "@/lib/format";
import { toDistribution } from "@/lib/stats/distribution";
import { compareGrades } from "@/lib/stats/grades";

export type CompareSeries = {
  code: string;
  name: string;
  selector: string;
  label: string;
  options: { value: string; label: string }[];
  grades: Record<string, number>;
  attempted: number;
  averageTotal: number | null;
  failureRate: number | null;
};

// Fixed categorical order — colour follows the position in the comparison, never a rank.
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

type TooltipProps = {
  active?: boolean;
  label?: string;
  payload?: { dataKey: string; value: number; color: string; name: string }[];
};

function CompareTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="mb-1 font-medium">Grade {label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium text-foreground">{(p.value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export function CompareView({ series }: { series: CompareSeries[] }) {
  const router = useRouter();
  const items: CompareItem[] = series.map((s) => ({ code: s.code, selector: s.selector }));

  const navigate = (next: CompareItem[]) => {
    router.push(next.length ? `/compare?m=${serializeCompare(next)}` : "/compare", { scroll: false });
  };

  const distributions = series.map((s) => toDistribution(s.grades));
  const allGrades = [...new Set(distributions.flatMap((d) => d.map((b) => b.grade)))].sort(compareGrades);
  const data = allGrades.map((grade) => {
    const row: Record<string, string | number | null> = { grade };
    distributions.forEach((d, i) => {
      row[`s${i}`] = d.find((b) => b.grade === grade)?.share ?? null;
    });
    return row;
  });

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        {series.map((s, i) => (
          <div key={`${s.code}-${i}`} className="flex min-w-64 flex-1 items-start gap-3 rounded-xl border bg-card p-3 md:max-w-sm">
            <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: COLORS[i] }} />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-xs text-muted-foreground">{s.code}</div>
              <div className="truncate font-medium" title={s.name}>
                {s.name}
              </div>
              <select
                value={s.selector}
                onChange={(e) => navigate(items.map((it, j) => (j === i ? { ...it, selector: e.target.value } : it)))}
                className="mt-2 h-8 w-full rounded-md border bg-background px-2 text-sm"
                aria-label={`Exam for ${s.code}`}
              >
                {s.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => navigate(items.filter((_, j) => j !== i))}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={`Remove ${s.code}`}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        {series.length < MAX_COMPARE && (
          <div className="min-w-64 flex-1 md:max-w-sm">
            <ModuleSearch
              size="sm"
              placeholder={series.length ? "Add another module…" : "Add a module, e.g. IN0001"}
              onSelect={(hit) => navigate([...items, { code: hit.code, selector: null }])}
            />
          </div>
        )}
      </div>

      {series.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Search for a module above to start comparing. Tip: you can compare the same module across semesters by adding it
            twice.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent>
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="grade"
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    width={52}
                  />
                  <Tooltip content={<CompareTooltip />} cursor={{ stroke: "var(--border)" }} />
                  {series.length > 1 && (
                    <Legend
                        iconType="plainline"
                        wrapperStyle={{ fontSize: 12 }}
                        formatter={(value: string) => <span style={{ color: "var(--muted-foreground)" }}>{value}</span>}
                      />
                  )}
                  {series.map((s, i) => (
                    <Line
                      key={`${s.code}-${i}`}
                      dataKey={`s${i}`}
                      name={`${s.code} · ${s.label}`}
                      stroke={COLORS[i]}
                      strokeWidth={2}
                      dot={{ r: 4, fill: COLORS[i], stroke: "var(--card)", strokeWidth: 2 }}
                      activeDot={{ r: 6, stroke: "var(--card)", strokeWidth: 2 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Series</th>
                  <th className="px-4 py-2.5 text-right font-medium">Participants</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg. grade</th>
                  <th className="px-4 py-2.5 text-right font-medium">Failure rate</th>
                  {allGrades.map((g) => (
                    <th key={g} className="hidden px-2 py-2.5 text-right font-medium lg:table-cell">
                      {g}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {series.map((s, i) => (
                  <tr key={`${s.code}-${i}`} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: COLORS[i] }} />
                        <span className="font-mono text-xs">{s.code}</span>
                        <span className="text-muted-foreground">{s.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCount(s.attempted)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatAverage(s.averageTotal)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatPercent(s.failureRate)}</td>
                    {allGrades.map((g) => {
                      const bin = distributions[i].find((b) => b.grade === g);
                      return (
                        <td key={g} className="hidden px-2 py-2.5 text-right text-muted-foreground tabular-nums lg:table-cell">
                          {bin ? `${Math.round(bin.share * 100)}%` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
