"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** A <select> bound to one URL search param; changing it resets pagination and dependent params. */
export function UrlSelect({
  name,
  label,
  options,
  value,
  resets = [],
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  resets?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          if (e.target.value) params.set(name, e.target.value);
          else params.delete(name);
          params.delete("page");
          for (const r of resets) params.delete(r);
          router.push(`${pathname}?${params.toString()}`, { scroll: false });
        }}
        className="h-9 min-w-40 rounded-md border bg-card px-2 text-sm text-foreground shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
