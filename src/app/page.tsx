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

export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center md:py-28">
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
      <Link href="/browse" className="text-sm text-primary underline-offset-4 hover:underline">
        or browse all modules by school →
      </Link>
    </section>
  );
}
