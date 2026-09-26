"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "", label: "Overview" },
  { href: "/profile", label: "Profile" },
  { href: "/structure", label: "Team structure" },
  { href: "/recruitment", label: "Recruitment & info sessions" },
  { href: "/applications", label: "Applications" },
];

export function DashboardNav({ slug, name }: { slug: string; name: string }) {
  const pathname = usePathname();
  const base = `/dashboard/${slug}`;
  return (
    <div>
      <Link href={`/clubs/${slug}`} className="text-xs/relaxed text-muted-foreground hover:text-foreground">
        ← Public profile
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{name}</h1>
      <nav className="mt-4 flex gap-1 overflow-x-auto border-b text-sm [scrollbar-width:none]" aria-label="Club dashboard">
        {ITEMS.map((item) => {
          const href = `${base}${item.href}`;
          const active = item.href === "" ? pathname === base || pathname.startsWith(`${base}/forms`) : pathname.startsWith(href);
          return (
            <Link
              key={item.href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2 transition-colors",
                active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
