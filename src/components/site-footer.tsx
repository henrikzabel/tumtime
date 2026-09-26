import Link from "next/link";

import { copy } from "@/lib/copy";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-start md:justify-between">
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
