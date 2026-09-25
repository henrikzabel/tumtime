import { cn } from "@/lib/utils";

export function StatTile({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
