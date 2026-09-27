"use client";

import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  FileText,
  GraduationCap,
  Shield,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
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
  contribute: Upload,
  imprint: FileText,
  privacy: Shield,
} satisfies Record<string, LucideIcon>;

export type NavItem = { href: string; label: string; match: string[]; icon: keyof typeof ICONS };

/** Sidebar rows on the gray canvas (cal.com), or the compact pills of the small-screen top bar. */
export function NavLinks({ items, variant = "bar" }: { items: NavItem[]; variant?: "sidebar" | "bar" }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
        if (variant === "bar") {
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors hover:bg-muted hover:text-foreground md:px-3",
                active ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        }
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[0.9375rem] transition-colors",
              active ? "bg-shell-active font-medium text-foreground" : "text-foreground/80 hover:bg-shell-hover hover:text-foreground",
            )}
          >
            <Icon className="size-4.5 shrink-0" strokeWidth={1.75} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
