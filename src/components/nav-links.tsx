"use client";

import { BookOpen, CalendarDays, ChartColumn, GraduationCap, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// Icons live here because components can't be passed from the server header into this client component.
const ICONS = {
  catalog: BookOpen,
  scheduler: CalendarDays,
  planner: GraduationCap,
  grades: ChartColumn,
  clubs: Users,
} satisfies Record<string, LucideIcon>;

export type NavItem = { href: string; label: string; match: string[]; icon: keyof typeof ICONS };

// EXPERIMENT: cal.com navigation — vertical sidebar items with icons (icon-only on medium screens), compact pills on mobile.
export function NavLinks({ items, variant = "bar" }: { items: NavItem[]; variant?: "sidebar" | "bar" }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={variant === "sidebar" ? item.label : undefined}
            className={cn(
              "group flex shrink-0 items-center gap-2.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
              variant === "sidebar" ? "h-9 justify-center px-2.5 lg:justify-start" : "px-2.5 py-1.5",
              active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {variant === "sidebar" ? (
              <Icon className={cn("size-4", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} aria-hidden />
            ) : null}
            <span className={variant === "sidebar" ? "sr-only lg:not-sr-only" : undefined}>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}
