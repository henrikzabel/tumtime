import { BookOpen, CalendarDays, ChartColumn, GraduationCap, Users } from "lucide-react";
import Link from "next/link";

import { ModuleSearch } from "@/components/module-search";
import { copy } from "@/lib/copy";

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

export default function HomePage() {
  return (
    <>
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pt-20 pb-12 text-center md:pt-28">
        <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">{copy.home.heading}</h1>
        <p className="max-w-2xl text-lg text-balance text-muted-foreground">{copy.home.subheading}</p>
        <ModuleSearch placeholder={copy.home.searchPlaceholder} autoFocus />
        <div className="flex flex-wrap justify-center gap-2 text-sm">
          <span className="text-muted-foreground">Popular:</span>
          {POPULAR.map((m) => (
            <Link
              key={m.code}
              href={`/modules/${m.code}`}
              title={m.name}
              className="rounded-full border bg-card px-3 py-0.5 font-mono text-xs transition-colors hover:bg-accent"
            >
              {m.code}
            </Link>
          ))}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-3 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-5" aria-label="Features">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href} className="group rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow hover:ring-primary/40">
            <f.icon className="size-5 text-primary" />
            <h2 className="mt-2 font-semibold">
              {f.title} <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
