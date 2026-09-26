"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Two panes like Berkeleytime: the result list on the left, the selected entry on the right.
 * On small screens only one pane is visible at a time.
 */
export function CatalogShell({ list, children }: { list: ReactNode; children: ReactNode }) {
  const selected = useSelectedLayoutSegment() !== null;
  return (
    <div className="grid h-[calc(100dvh-4.5rem)] min-h-[32rem] md:grid-cols-[minmax(20rem,26rem)_1fr]">
      <aside className={cn("min-h-0 border-r bg-card/40", selected && "hidden md:block")}>{list}</aside>
      <section className={cn("min-h-0 overflow-y-auto", !selected && "hidden md:block")}>{children}</section>
    </div>
  );
}
