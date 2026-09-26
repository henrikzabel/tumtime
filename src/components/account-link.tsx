"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Me = { email: string; role: string } | null;

export function AccountLink() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, [pathname]);

  const cls =
    "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs/relaxed font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-2.5";
  if (me === undefined) return <span className="w-14" />;
  if (!me) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={cls}>
        Sign in
      </Link>
    );
  }
  return (
    <Link href="/me" className={cls} title={me.email}>
      <UserRound className="size-3.5" />
      <span className="hidden sm:inline">Account</span>
    </Link>
  );
}
