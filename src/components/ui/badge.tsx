import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// EXPERIMENT: cal.com badge — small, square-ish, tinted fills instead of solid pills.
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center overflow-hidden whitespace-nowrap focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-5 gap-1 rounded-md border border-transparent px-1.5 py-0.5 text-xs font-medium transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3! [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-info-bg text-info [a]:hover:bg-info-bg/80",
        secondary: "bg-accent text-accent-foreground [a]:hover:bg-accent/80",
        outline:
          "border-border bg-background text-foreground [a]:hover:bg-muted",
        destructive:
          "bg-red-100 text-red-800 [a]:hover:bg-red-200 dark:bg-red-950 dark:text-red-300",
        success: "bg-success-bg text-success [a]:hover:bg-success-bg/80",
        attention: "bg-attention-bg text-attention [a]:hover:bg-attention-bg/80",
        ghost: "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant = "default", ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
