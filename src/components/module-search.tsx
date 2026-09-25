"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Hit = { code: string; nameEn: string | null; nameDe: string | null; ects: number | null };

export function ModuleSearch({
  placeholder,
  autoFocus,
  className,
  size = "lg",
  onSelect,
}: {
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  size?: "lg" | "sm";
  /** Override navigation, e.g. to add a module to a comparison. */
  onSelect?: (hit: Hit) => void;
}) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (res.ok) {
          setHits(await res.json());
          setActive(0);
          setOpen(true);
        }
      } catch {
        // aborted or offline — keep previous results
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Results for a query that is too short are never shown (derived, not reset in an effect).
  const hits = query.trim().length >= 2 ? results : [];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function choose(hit: Hit) {
    setOpen(false);
    if (onSelect) {
      onSelect(hit);
      setQuery("");
      setHits([]);
    } else {
      router.push(`/modules/${encodeURIComponent(hit.code)}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      choose(hits[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showEmpty = open && !loading && query.trim().length >= 2 && hits.length === 0;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <Search
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          size === "lg" ? "left-4 size-5" : "left-3 size-4",
        )}
      />
      <input
        type="search"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && hits[active] ? `${listId}-${active}` : undefined}
        autoFocus={autoFocus}
        value={query}
        placeholder={placeholder}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        onKeyDown={onKeyDown}
        className={cn(
          "w-full rounded-xl border bg-card shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40",
          size === "lg" ? "h-14 pl-12 pr-4 text-base" : "h-9 pl-9 pr-3 text-sm",
        )}
      />
      {open && hits.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border bg-popover text-left shadow-lg"
        >
          {hits.map((hit, i) => (
            <li
              key={hit.code}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(hit);
              }}
              className={cn(
                "flex cursor-pointer items-baseline gap-3 px-4 py-2.5",
                i === active && "bg-accent text-accent-foreground",
              )}
            >
              <span className="w-24 shrink-0 font-mono text-sm font-medium">{hit.code}</span>
              <span className="truncate">{hit.nameEn ?? hit.nameDe ?? "—"}</span>
              {hit.ects ? <span className="ml-auto shrink-0 text-xs text-muted-foreground">{hit.ects} ECTS</span> : null}
            </li>
          ))}
        </ul>
      )}
      {showEmpty && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border bg-popover px-4 py-3 text-left text-sm text-muted-foreground shadow-lg">
          No modules found for “{query.trim()}”.
        </div>
      )}
    </div>
  );
}
