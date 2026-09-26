"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { planStateSchema, type PlanState } from "@/lib/planner/plan";
import { createDegreePlan } from "@/lib/planning/actions";

const PREFIX = "tumtime.plan.v1:";

/** Plans made before accounts existed live in localStorage; offer to move them to the account once. */
export function ImportLocalPlans({ hasPlans }: { hasPlans: boolean }) {
  const router = useRouter();
  const [found, setFound] = useState<{ key: string; state: PlanState }[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const list = Object.keys(window.localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .flatMap((key) => {
          const parsed = planStateSchema.safeParse(
            JSON.parse(window.localStorage.getItem(key) ?? "null"),
          );
          return parsed.success
            ? [{ key, state: parsed.data as unknown as PlanState }]
            : [];
        });
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser-only storage once
      setFound(list);
    } catch {}
  }, []);

  if (found.length === 0) return null;
  return (
    <div className="mt-6 flex flex-col gap-2 rounded-lg bg-muted/60 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span>
        Found {found.length} plan{found.length > 1 ? "s" : ""} saved in this
        browser from before accounts existed.
        {hasPlans ? "" : " Import to keep working on it."}
      </span>
      <div className="flex gap-2">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              for (const f of found) {
                await createDegreePlan({
                  name: `Imported ${f.state.program}`,
                  state: f.state,
                });
                window.localStorage.removeItem(f.key);
              }
              setFound([]);
              router.refresh();
            })
          }
        >
          Import
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            found.forEach((f) => window.localStorage.removeItem(f.key));
            setFound([]);
          }}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
