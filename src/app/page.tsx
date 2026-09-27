import { ArrowRight, BookOpen, CalendarDays, ChartColumn, ChevronRight, Clock, Globe, GraduationCap, MapPin, Users } from "lucide-react";
import Link from "next/link";

import { AccountLink } from "@/components/account-link";
import { ModuleSearch } from "@/components/module-search";
import { navItems, UnofficialBanner, Wordmark } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const POPULAR = [
  { code: "IN0001", name: "Introduction to Informatics" },
  { code: "IN0015", name: "Discrete Structures" },
  { code: "MA0901", name: "Linear Algebra for Informatics" },
  { code: "IN0008", name: "Fundamentals of Databases" },
  { code: "IN2346", name: "Introduction to Deep Learning" },
];

const FEATURES = [
  {
    href: "/catalog",
    icon: BookOpen,
    title: "Catalog",
    text: "Every module and course of the semester with descriptions, lecture and tutorial times, rooms and grades.",
  },
  {
    href: "/schedules",
    icon: CalendarDays,
    title: "Scheduler",
    text: "Build your week, pick tutorial groups and let TUM Time generate clash-free schedules.",
  },
  {
    href: "/degree-planner",
    icon: GraduationCap,
    title: "Degree planner",
    text: "Plan all semesters from your study plan and track ECTS and requirements.",
  },
  {
    href: "/browse",
    icon: ChartColumn,
    title: "Grades",
    text: "Grade distributions, averages and failure rates of TUM exams across semesters.",
  },
  {
    href: "/clubs",
    icon: Users,
    title: "Clubs",
    text: "Discover all student clubs and apply directly with your TUM account.",
  },
];

// EXPERIMENT: cal.com-style landing page — gray canvas, marketing top bar and the hero inside one large white card.
export default function HomePage() {
  return (
    <div className="min-h-dvh bg-shell">
      <UnofficialBanner />
      <div className="mx-auto max-w-7xl border-x border-black/[0.06] dark:border-white/[0.06]">
        <header className="flex h-18 items-center justify-between gap-6 px-4 md:px-8">
          <Wordmark className="text-xl" />
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-[0.9375rem] text-foreground/80 transition-colors hover:bg-shell-hover hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <AccountLink className="hidden text-[0.9375rem] text-foreground/80 hover:bg-shell-hover sm:flex" />
            <Link href="/catalog" className={cn(buttonVariants(), "h-9 pr-2.5 text-[0.9375rem]")}>
              Open catalog <ChevronRight />
            </Link>
          </div>
        </header>

        <div className="px-2 md:px-3">
          <section className="overflow-hidden rounded-3xl border bg-background shadow-[0_1px_3px_rgb(0_0_0/0.04)]">
            <div className="grid items-center gap-12 py-12 pl-6 md:py-20 md:pl-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:py-24">
              <div className="pr-6 md:pr-16 lg:pr-0">
                <Link
                  href="/clubs/info-sessions"
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-[0.8125rem] font-medium shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors hover:bg-muted"
                >
                  New: club info session weeks <ChevronRight className="size-3.5" />
                </Link>
                <h1 className="mt-5 text-5xl leading-[1.02] font-semibold tracking-[-0.015em] text-balance md:text-6xl">
                  {copy.home.heading}
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">{copy.home.subheading}</p>
                <div className="mt-8 max-w-xl space-y-3">
                  <ModuleSearch placeholder={copy.home.searchPlaceholder} autoFocus />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Link href="/schedules" className={cn(buttonVariants({ size: "lg" }), "h-11 text-[0.9375rem]")}>
                      <CalendarDays /> Build your week
                    </Link>
                    <Link href="/catalog" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 text-[0.9375rem]")}>
                      Browse the catalog <ChevronRight />
                    </Link>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  Popular:
                  {POPULAR.map((m) => (
                    <Link
                      key={m.code}
                      href={`/modules/${m.code}`}
                      title={m.name}
                      className="rounded-md border bg-background px-2 py-0.5 font-mono text-xs text-foreground transition-colors hover:bg-muted"
                    >
                      {m.code}
                    </Link>
                  ))}
                </div>
              </div>
              <HeroPreview />
            </div>
          </section>
        </div>

        <section aria-label="Features" className="px-4 py-16 md:px-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <h2 className="text-3xl font-semibold">Everything for your semester</h2>
            <p className="max-w-md text-muted-foreground">Free, made by students, and no sign-up needed to browse.</p>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FEATURES.map((f) => (
              <li key={f.href}>
                <Link
                  href={f.href}
                  className="group flex h-full flex-col rounded-2xl border bg-background p-5 shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition-shadow hover:shadow-md"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-info-bg text-primary">
                    <f.icon className="size-4.5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Open <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <footer className="flex flex-col gap-4 border-t border-black/[0.06] px-4 py-8 text-sm text-muted-foreground md:flex-row md:justify-between md:px-8 dark:border-white/[0.06]">
          <p className="max-w-2xl leading-relaxed">{copy.footer.disclaimer}</p>
          <nav className="flex shrink-0 gap-4">
            <Link href="/contribute" className="hover:text-foreground">
              Contribute data
            </Link>
            <Link href="/imprint" className="hover:text-foreground">
              {copy.footer.imprint}
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              {copy.footer.privacy}
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
// October 2026 starts on a Thursday; lectures run Tuesdays and Thursdays from the 13th.
const OCTOBER: (number | null)[] = [null, null, null, ...Array.from({ length: 31 }, (_, i) => i + 1)];

/** Illustrative product preview in the spirit of cal.com's booking widget: a module and its lecture days. */
function HeroPreview() {
  return (
    <div aria-hidden className="pointer-events-none hidden min-w-0 overflow-hidden rounded-l-2xl md:flex border border-r-0 bg-background select-none">
      <div className="hidden w-64 shrink-0 border-r p-6 sm:block">
        <span className="grid size-8 place-items-center rounded-full bg-primary text-[0.625rem] font-bold text-primary-foreground">IN</span>
        <p className="mt-3 text-sm text-muted-foreground">IN0001 · Winter 2026/27</p>
        <p className="text-xl leading-tight font-semibold">Introduction to Informatics</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Algorithms, data structures and your first programs in Java.</p>
        <div className="mt-5 flex w-fit rounded-lg bg-muted p-0.5 text-sm">
          <span className="px-2 py-1 text-muted-foreground">Lecture</span>
          <span className="rounded-md bg-background px-2 py-1 font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)]">Tutorial</span>
          <span className="px-2 py-1 text-muted-foreground">Exam</span>
        </div>
        <ul className="mt-5 space-y-3 text-sm text-foreground/80">
          <li className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" /> Tue 10:15 – 11:45
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" /> Interims Hörsaal 1
          </li>
          <li className="flex items-center gap-2">
            <Globe className="size-4 text-muted-foreground" /> English
          </li>
        </ul>
      </div>
      <div className="min-w-0 flex-1 p-6">
        <p className="text-lg font-semibold">
          October <span className="font-normal text-muted-foreground">2026</span>
        </p>
        <div className="mt-5 grid w-[30rem] grid-cols-7 gap-1.5 text-center text-sm">
          {WEEKDAYS.map((d) => (
            <span key={d} className="pb-2 text-xs font-medium text-muted-foreground">
              {d}
            </span>
          ))}
          {OCTOBER.map((day, i) => {
            const weekday = i % 7;
            const lecture = day !== null && day >= 13 && (weekday === 1 || weekday === 3);
            return (
              <span
                key={i}
                className={cn(
                  "grid aspect-square place-items-center rounded-lg",
                  day === 20 ? "bg-primary font-medium text-primary-foreground" : lecture ? "bg-muted font-medium" : "text-muted-foreground",
                )}
              >
                {day}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
