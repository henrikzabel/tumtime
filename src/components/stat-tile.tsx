import { cn } from "@/lib/utils";

export function StatTile({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className={cn("rounded-lg bg-card p-4 ring-1 ring-foreground/10", className)}>
      <div className="text-xs/relaxed font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
