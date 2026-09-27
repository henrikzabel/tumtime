import * as React from "react";

import { cn } from "@/lib/utils";

// EXPERIMENT: cal.com inputs — white field, gray border that darkens on hover, brand-coloured focus ring.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-[10px] border border-input bg-background px-3 py-1 text-sm shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground hover:border-foreground/40 focus-visible:border-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/15 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-[10px] border border-input bg-background px-3 py-2 text-sm shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground hover:border-foreground/40 focus-visible:border-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/15 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("flex flex-col gap-1.5 text-sm font-medium text-foreground", className)} {...props} />;
}

export { Input, Textarea, Label };
