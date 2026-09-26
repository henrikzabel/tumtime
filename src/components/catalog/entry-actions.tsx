"use client";

import { Bookmark, CalendarPlus, Check, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { addModuleToSchedule, createSchedule, toggleBookmark } from "@/lib/planning/actions";
import { cn } from "@/lib/utils";

type ScheduleOption = { id: string; name: string; has: boolean };

export function EntryActions({
  entryKey,
  semester,
  loggedIn,
  bookmarked: initialBookmarked,
  schedules,
}: {
  entryKey: string;
  semester: string;
  loggedIn: boolean;
  bookmarked: boolean;
  schedules: ScheduleOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => menu.current && !menu.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!loggedIn) {
    const login = `/login?next=${encodeURIComponent(pathname)}`;
    return (
      <div className="flex shrink-0 gap-2">
        <Link href={login} className={buttonVariants({ variant: "outline" })}>
          <Bookmark /> Bookmark
        </Link>
        <Link href={login} className={buttonVariants()}>
          <CalendarPlus /> Add to schedule
        </Link>
      </div>
    );
  }

  const add = (scheduleId?: string) =>
    startTransition(async () => {
      const id = scheduleId
        ? await addModuleToSchedule(entryKey, semester, scheduleId)
        : await createSchedule({ semester, moduleCodes: [entryKey], name: `Schedule ${schedules.length + 1}` });
      setOpen(false);
      router.push(`/schedules/${id}`);
    });

  return (
    <div className="relative flex shrink-0 gap-2" ref={menu}>
      <Button
        variant="outline"
        aria-pressed={bookmarked}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setBookmarked(await toggleBookmark(entryKey, pathname));
            router.refresh();
          })
        }
      >
        <Bookmark className={cn(bookmarked && "fill-current text-primary")} /> {bookmarked ? "Bookmarked" : "Bookmark"}
      </Button>
      <Button aria-expanded={open} aria-haspopup="menu" disabled={pending} onClick={() => setOpen((v) => !v)}>
        <CalendarPlus /> Add to schedule
      </Button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-20 mt-1 w-64 rounded-lg border bg-popover p-1 text-sm shadow-lg">
          {schedules.map((s) => (
            <button
              key={s.id}
              role="menuitem"
              type="button"
              disabled={pending}
              onClick={() => (s.has ? router.push(`/schedules/${s.id}`) : add(s.id))}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              {s.has ? <Check className="size-3.5 text-primary" /> : <Plus className="size-3.5" />}
              <span className="truncate">{s.name}</span>
              {s.has && <span className="ml-auto text-xs text-muted-foreground">open</span>}
            </button>
          ))}
          <button
            role="menuitem"
            type="button"
            disabled={pending}
            onClick={() => add()}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-medium hover:bg-muted"
          >
            <Plus className="size-3.5" /> New schedule
          </button>
        </div>
      )}
    </div>
  );
}
