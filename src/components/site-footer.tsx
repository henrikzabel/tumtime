import Link from "next/link";

import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("mt-auto border-t", className)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-xs/relaxed text-muted-foreground md:flex-row md:items-start md:justify-between">
        <p className="max-w-2xl leading-relaxed">{copy.footer.disclaimer}</p>
        <nav className="flex shrink-0 gap-4">
          <Link href="/contribute" className="hover:text-foreground">
            Contribute data
          </Link>
          <Link href="/imprint" className="hover:text-foreground">
            {copy.footer.imprint}
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            {copy.footer.privacy}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
