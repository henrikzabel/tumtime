import { cn } from "@/lib/utils";

export function StatTile({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className={cn("rounded-xl bg-card p-4 ring-1 ring-border", className)}>
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold text-2xl tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs/relaxed text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
