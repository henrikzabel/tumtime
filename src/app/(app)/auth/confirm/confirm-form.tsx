"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { confirmLogin, type ConfirmState } from "@/lib/auth/actions";

// A button (POST) instead of signing in on page load: e-mail scanners open links automatically.
export function ConfirmForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmLogin, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <p className="text-sm text-destructive">
          {state.error}{" "}
          <Link href="/login" className="underline">
            Request a new link
          </Link>
        </p>
      ) : (
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      )}
    </form>
  );
}
