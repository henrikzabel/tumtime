import Link from "next/link";

import { copy } from "@/lib/copy";

const navItems = [
  { href: "/browse", label: copy.nav.browse },
  { href: "/compare", label: copy.nav.compare },
  { href: "/planner", label: copy.nav.planner },
  { href: "/contribute", label: copy.nav.contribute },
] as const;

export function UnofficialBanner() {
  return (
    <div className="bg-banner px-4 py-1 text-center text-[0.6875rem] text-banner-foreground" role="note">
      {copy.unofficialBanner}
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight whitespace-nowrap">
          <span className="grid size-6 place-items-center rounded-md bg-primary text-[0.625rem] font-bold text-primary-foreground">
            TT
          </span>
          {copy.siteName}
        </Link>
        <nav className="flex items-center text-xs/relaxed font-medium sm:gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-2.5"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
