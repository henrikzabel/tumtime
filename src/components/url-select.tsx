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
    <label className="flex flex-col gap-1 text-xs/relaxed font-medium text-muted-foreground">
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
        className="h-9 min-w-40 rounded-[10px] border border-input bg-background shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:border-foreground/40 px-2 text-sm font-normal text-foreground outline-none transition-colors focus-visible:border-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/15"
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
