import Link from "next/link";

import { AccountLink } from "@/components/account-link";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { copy } from "@/lib/copy";

const navItems: NavItem[] = [
  { href: "/catalog", label: copy.nav.catalog, match: ["/catalog"], icon: "catalog" },
  { href: "/schedules", label: copy.nav.scheduler, match: ["/schedules"], icon: "scheduler" },
  { href: "/degree-planner", label: copy.nav.degreePlanner, match: ["/degree-planner"], icon: "planner" },
  { href: "/browse", label: copy.nav.grades, match: ["/browse", "/compare", "/modules", "/contribute"], icon: "grades" },
  { href: "/clubs", label: copy.nav.clubs, match: ["/clubs"], icon: "clubs" },
];

function Logo({ collapsible = false }: { collapsible?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 font-cal text-lg whitespace-nowrap text-foreground">
      <span className="grid size-7 place-items-center rounded-lg bg-primary font-cal text-xs text-primary-foreground">TT</span>
      <span className={collapsible ? "sr-only lg:not-sr-only" : undefined}>{copy.siteName}</span>
    </Link>
  );
}

export function UnofficialBanner() {
  return (
    <div className="bg-banner px-4 py-1.5 text-center text-xs text-banner-foreground" role="note">
      {copy.unofficialBanner}
    </div>
  );
}

// EXPERIMENT: cal.com app shell — a fixed left sidebar on desktop replaces the top navigation bar.
export function SiteSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-16 shrink-0 lg:w-60 flex-col border-r bg-shell md:flex">
      <div className="flex h-16 items-center justify-center px-4 lg:justify-start">
        <Logo collapsible />
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
        <NavLinks items={navItems} variant="sidebar" />
      </nav>
      <div className="border-t px-3 py-3">
        <AccountLink className="h-9 w-full justify-center px-2.5 lg:justify-start" labelClassName="sr-only lg:not-sr-only" />
      </div>
    </aside>
  );
}

// Small screens keep a top bar; every section stays visible in a scrollable second row.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl md:hidden">
      <div className="flex h-14 items-center justify-between gap-4 px-4">
        <Logo />
        <div className="-mr-2">
          <AccountLink />
        </div>
      </div>
      <nav
        aria-label="Main"
        className="flex items-center gap-1 overflow-x-auto px-2 pb-2 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none]"
      >
        <NavLinks items={navItems} />
      </nav>
    </header>
  );
}
