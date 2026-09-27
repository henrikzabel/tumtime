"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Me = { email: string; role: string } | null;

export function AccountLink({ className, labelClassName }: { className?: string; labelClassName?: string }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, [pathname]);

  const cls = cn(
    "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
    className,
  );
  if (me === undefined) return <span className={cn("block h-8 w-14", className)} />;
  if (!me) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={cls}>
        <UserRound className="size-4" />
        <span className={labelClassName}>Sign in</span>
      </Link>
    );
  }
  return (
    <Link href="/me" className={cls} title={me.email}>
      <UserRound className="size-4" />
      <span className={labelClassName ?? "hidden sm:inline"}>Account</span>
    </Link>
  );
}
