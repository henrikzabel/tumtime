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
    <div className="bg-banner px-4 py-1.5 text-center text-xs text-banner-foreground" role="note">
      {copy.unofficialBanner}
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[100rem] items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight whitespace-nowrap">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-[0.6875rem] font-bold text-primary-foreground">
            TT
          </span>
          {copy.siteName}
        </Link>
        <nav aria-label="Main" className="-mr-2 hidden items-center gap-1 text-sm font-medium md:flex">
          <NavLinks items={navItems} />
          <AccountLink />
        </nav>
        <div className="-mr-2 md:hidden">
          <AccountLink />
        </div>
      </div>
      {/* Small screens: all sections stay visible in a second row instead of being clipped. */}
      <nav
        aria-label="Main"
        className="flex items-center overflow-x-auto px-2 pb-2 text-sm font-medium [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] md:hidden"
      >
        <NavLinks items={navItems} />
      </nav>
    </header>
  );
}
