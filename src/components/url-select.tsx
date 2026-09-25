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
        className="h-7 min-w-40 rounded-md border border-input bg-input/20 px-2 text-xs/relaxed font-normal text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
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
