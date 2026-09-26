"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { ClubListItem } from "@/lib/clubs/queries";
import { cn } from "@/lib/utils";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs/relaxed ring-1 transition-colors",
        active ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-muted-foreground ring-foreground/10 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function ClubDirectory({ clubs }: { clubs: ClubListItem[] }) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [recruiting, setRecruiting] = useState(false);

  const areas = useMemo(() => [...new Set(clubs.flatMap((c) => c.focusAreas))].sort(), [clubs]);
  const locations = useMemo(() => [...new Set(clubs.flatMap((c) => c.locations))].sort(), [clubs]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return clubs
      .filter(
        (c) =>
          (!q || normalize(`${c.name} ${c.summary ?? ""} ${c.focusAreas.join(" ")}`).includes(q)) &&
          (!area || c.focusAreas.includes(area)) &&
          (!location || c.locations.includes(location)) &&
          (!recruiting || c.recruiting),
      )
      .sort((a, b) => Number(b.recruiting) - Number(a.recruiting) || a.name.localeCompare(b.name));
  }, [clubs, query, area, location, recruiting]);

  return (
    <div className="mt-6">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clubs, e.g. robotics, consulting, music…"
          className="h-10 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Chip active={recruiting} onClick={() => setRecruiting(!recruiting)}>
          Recruiting now
        </Chip>
        <span className="mx-1 h-4 w-px bg-border" />
        {areas.map((a) => (
          <Chip key={a} active={area === a} onClick={() => setArea(area === a ? null : a)}>
            {a}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs/relaxed text-muted-foreground">Campus:</span>
        {locations.map((l) => (
          <Chip key={l} active={location === l} onClick={() => setLocation(location === l ? null : l)}>
            {l}
          </Chip>
        ))}
      </div>

      <p className="mt-4 text-xs/relaxed text-muted-foreground">{visible.length} clubs</p>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((c, i) => (
          <Link
            key={c.slug}
            href={`/clubs/${c.slug}`}
            className="group flex flex-col overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10 transition-shadow hover:ring-foreground/25"
          >
            <div className="relative aspect-[16/9] bg-muted">
              {c.imageUrl && (
                <Image
                  src={c.imageUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  loading={i < 6 ? "eager" : "lazy"}
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              )}
              {c.recruiting && <Badge className="absolute top-2 left-2 shadow-sm">Recruiting</Badge>}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <h2 className="font-semibold tracking-tight group-hover:text-primary">{c.name}</h2>
              {c.summary && <p className="line-clamp-3 text-xs/relaxed text-muted-foreground">{c.summary}</p>}
              <div className="mt-auto flex flex-wrap gap-1 pt-1">
                {c.focusAreas.map((a) => (
                  <Badge key={a} variant="outline">
                    {a}
                  </Badge>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {visible.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No clubs match these filters.</p>}
    </div>
  );
}
