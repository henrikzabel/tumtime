import Link from "next/link";

import { AccountLink } from "@/components/account-link";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { copy } from "@/lib/copy";

const navItems: NavItem[] = [
  { href: "/catalog", label: copy.nav.catalog, match: ["/catalog"] },
  { href: "/schedules", label: copy.nav.scheduler, match: ["/schedules"] },
  { href: "/degree-planner", label: copy.nav.degreePlanner, match: ["/degree-planner"] },
  { href: "/browse", label: copy.nav.grades, match: ["/browse", "/compare", "/modules", "/contribute"] },
  { href: "/clubs", label: copy.nav.clubs, match: ["/clubs"] },
];

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
      <div className="mx-auto flex h-12 max-w-[100rem] items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight whitespace-nowrap">
          <span className="grid size-6 place-items-center rounded-md bg-primary text-[0.625rem] font-bold text-primary-foreground">
            TT
          </span>
          {copy.siteName}
        </Link>
        <nav className="-mr-2 flex min-w-0 items-center overflow-x-auto text-xs/relaxed font-medium [scrollbar-width:none] sm:gap-1">
          <NavLinks items={navItems} />
          <AccountLink />
        </nav>
      </div>
    </header>
  );
}
