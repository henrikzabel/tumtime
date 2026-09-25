import Link from "next/link";

import { copy } from "@/lib/copy";

const navItems = [
  { href: "/browse", label: copy.nav.browse },
  { href: "/compare", label: copy.nav.compare },
  { href: "/contribute", label: copy.nav.contribute },
] as const;

export function UnofficialBanner() {
  return (
    <div className="bg-brand-dark px-4 py-1 text-center text-xs text-white/85" role="note">
      {copy.unofficialBanner}
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            TT
          </span>
          {copy.siteName}
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
