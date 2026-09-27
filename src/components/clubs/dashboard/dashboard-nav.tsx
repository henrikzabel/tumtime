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
      <h1 className="mt-1 text-xl font-semibold">{name}</h1>
      <nav className="mt-4 flex gap-1 overflow-x-auto text-sm [scrollbar-width:none]" aria-label="Club dashboard">
        {ITEMS.map((item) => {
          const href = `${base}${item.href}`;
          const active = item.href === "" ? pathname === base || pathname.startsWith(`${base}/forms`) : pathname.startsWith(href);
          return (
            <Link
              key={item.href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 font-medium transition-colors",
                active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
