export function ProsePage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="space-y-4 leading-relaxed text-muted-foreground">{children}</div>
    </article>
  );
}
