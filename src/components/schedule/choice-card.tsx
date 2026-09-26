"use client";

import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Choice } from "@/lib/planner/choices";
import { formatSlot, overlaps, type WeeklySlot } from "@/lib/planner/timetable";
import { SKIP } from "@/lib/schedule/selection";
import { cn } from "@/lib/utils";

export function ChoiceCard({
  choice,
  color,
  chosenGroup,
  skipped,
  slotsByGroup,
  otherSlots,
  inClash,
  onSelect,
}: {
  choice: Choice;
  color: string;
  chosenGroup: number | undefined;
  skipped: boolean;
  slotsByGroup: Map<number, WeeklySlot[]>;
  otherSlots: WeeklySlot[];
  inClash: boolean;
  onSelect: (groupId: number) => void;
}) {
  const describe = (groupId: number) =>
    (slotsByGroup.get(groupId) ?? [])
      .map((s) => `${formatSlot(s)}${s.room ? ` · ${s.room}` : ""}`)
      .join(", ") || "No regular dates";
  const clashesWithOthers = (groupId: number) =>
    (slotsByGroup.get(groupId) ?? []).some((s) =>
      otherSlots.some((o) => overlaps(s, o)),
    );
  const options = [...choice.options].sort((a, b) => {
    const sa = slotsByGroup.get(a.groupId)?.[0];
    const sb = slotsByGroup.get(b.groupId)?.[0];
    return (
      (sa?.weekday ?? 9) - (sb?.weekday ?? 9) ||
      (sa?.startMinutes ?? 0) - (sb?.startMinutes ?? 0)
    );
  });

  return (
    <Card size="sm" className={cn(inClash && "ring-destructive/60")}>
      <CardHeader>
        <CardTitle className="flex items-start gap-2 text-xs/relaxed">
          <span
            className="mt-1 size-2 shrink-0 rounded-full"
            style={{ background: color }}
          />
          <span className="min-w-0 flex-1">
            {choice.title}
            <span className="mt-0.5 flex items-center gap-1.5 font-normal text-muted-foreground">
              {choice.activity && (
                <Badge variant="outline">{choice.activity}</Badge>
              )}
              {choice.options.length > 1 && `${choice.options.length} groups`}
              {choice.tumonlineUrl && (
                <a
                  href={choice.tumonlineUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground"
                  aria-label="Open in TUMonline"
                >
                  <ExternalLink className="size-3" />
                </a>
              )}
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {choice.options.length === 1 ? (
          <p className="text-[0.6875rem] text-muted-foreground">
            {describe(choice.options[0].groupId)}
          </p>
        ) : (
          <>
            <select
              value={
                skipped ? String(SKIP) : chosenGroup ? String(chosenGroup) : ""
              }
              onChange={(e) => onSelect(Number(e.target.value))}
              className={cn(
                "h-7 w-full rounded-md border border-input bg-input/20 px-2 text-xs/relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                !chosenGroup && !skipped && "border-primary/60",
              )}
              aria-label={`Group for ${choice.title}`}
            >
              <option value="" disabled>
                Choose a group…
              </option>
              {options.map((o) => (
                <option key={o.groupId} value={o.groupId}>
                  {describe(o.groupId)} — {o.label}
                  {clashesWithOthers(o.groupId) ? "  ⚠ clash" : ""}
                </option>
              ))}
              <option value={SKIP}>Not attending</option>
            </select>
            {chosenGroup && (
              <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                {describe(chosenGroup)}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
