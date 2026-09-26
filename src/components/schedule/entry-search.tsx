"use client";

import { Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Hit = { key: string; title: string; ects: number | null; school: string | null };

/** Search the semester's catalog and pick a module/course to add. */
export function EntrySearch({ semester, exclude, onSelect }: { semester: string; exclude: string[]; onSelect: (key: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/catalog/search?semester=${semester}&q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json() as Promise<Hit[]>)
        .then(setHits)
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, semester]);

  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const visible = q.trim().length < 2 ? [] : hits.filter((h) => !exclude.includes(h.key));
  return (
    <div className="relative" ref={box}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Add a module or course…"
        aria-label="Add a module or course"
        className="h-8 w-full rounded-md border border-input bg-input/20 pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
      />
      {open && visible.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg" role="listbox">
          {visible.map((h) => (
            <li key={h.key}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onSelect(h.key);
                  setQ("");
                  setHits([]);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <Plus className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate">{h.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {[h.key.startsWith("C_") ? "Course" : h.key, h.ects !== null ? `${h.ects} ECTS` : null, h.school].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
