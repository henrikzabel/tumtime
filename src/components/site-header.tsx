import { Search } from "lucide-react";
import Link from "next/link";

import { AccountLink } from "@/components/account-link";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

export const navItems: NavItem[] = [
  { href: "/catalog", label: copy.nav.catalog, match: ["/catalog"], icon: "catalog" },
  { href: "/schedules", label: copy.nav.scheduler, match: ["/schedules"], icon: "scheduler" },
  { href: "/degree-planner", label: copy.nav.degreePlanner, match: ["/degree-planner"], icon: "planner" },
  { href: "/browse", label: copy.nav.grades, match: ["/browse", "/compare", "/modules"], icon: "grades" },
  { href: "/clubs", label: copy.nav.clubs, match: ["/clubs"], icon: "clubs" },
];

const secondaryItems: NavItem[] = [
  { href: "/contribute", label: "Contribute data", match: ["/contribute"], icon: "contribute" },
  { href: "/imprint", label: copy.footer.imprint, match: ["/imprint"], icon: "imprint" },
  { href: "/privacy", label: copy.footer.privacy, match: ["/privacy"], icon: "privacy" },
];

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight whitespace-nowrap", className)}>
      <span className="grid size-6.5 place-items-center rounded-md bg-primary text-[0.625rem] font-bold text-primary-foreground">TT</span>
      {copy.siteName}
    </Link>
  );
}

export function UnofficialBanner({ className }: { className?: string }) {
  return (
    <div className={cn("bg-banner px-4 py-1.5 text-center text-xs text-banner-foreground", className)} role="note">
      {copy.unofficialBanner}
    </div>
  );
}

// EXPERIMENT: cal.com sidebar — sits directly on the gray canvas, no border, primary sections on top and
// secondary links pinned to the bottom.
export function SiteSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col px-3 pt-4 pb-3 lg:flex">
      <div className="flex h-9 items-center justify-between gap-2 pl-2.5">
        <Wordmark />
        <div className="flex items-center">
          <Link
            href="/browse"
            aria-label="Search modules"
            className="grid size-8 place-items-center rounded-lg text-foreground/80 transition-colors hover:bg-shell-hover hover:text-foreground"
          >
            <Search className="size-4.5" strokeWidth={1.75} />
          </Link>
          <AccountLink className="size-8 justify-center rounded-lg px-0 text-foreground/80 hover:bg-shell-hover" labelClassName="sr-only" />
        </div>
      </div>
      <nav aria-label="Main" className="mt-5 flex flex-1 flex-col gap-0.5 overflow-y-auto">
        <NavLinks items={navItems} variant="sidebar" />
      </nav>
      <nav aria-label="More" className="flex flex-col gap-0.5">
        <NavLinks items={secondaryItems} variant="sidebar" />
      </nav>
      <p className="mt-4 px-2.5 text-[0.6875rem] leading-snug text-muted-foreground" role="note">
        {copy.unofficialBanner}
      </p>
    </aside>
  );
}

// Below lg: the classic top bar; on phones every section stays visible in a scrollable second row.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex h-14 max-w-[100rem] items-center justify-between gap-4 px-4">
        <Wordmark className="text-base" />
        <nav aria-label="Main" className="-mr-2 hidden items-center gap-1 text-sm font-medium md:flex">
          <NavLinks items={navItems} />
          <AccountLink />
        </nav>
        <div className="-mr-2 md:hidden">
          <AccountLink />
        </div>
      </div>
      <nav
        aria-label="Main"
        className="flex items-center overflow-x-auto px-2 pb-2 text-sm font-medium [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] md:hidden"
      >
        <NavLinks items={navItems} />
      </nav>
    </header>
  );
}
