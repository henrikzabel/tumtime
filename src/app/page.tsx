import { copy } from "@/lib/copy";

export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center md:py-28">
      <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">{copy.home.heading}</h1>
      <p className="max-w-2xl text-lg text-balance text-muted-foreground">{copy.home.subheading}</p>
      {/* Search with autocomplete arrives in milestone 6. */}
      <input
        type="search"
        disabled
        placeholder={copy.home.searchPlaceholder}
        className="h-12 w-full rounded-xl border bg-card px-4 text-base shadow-sm"
      />
    </section>
  );
}
