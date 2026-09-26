"use client";

import { MailCheck } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { requestLoginLink, type LoginState } from "@/lib/auth/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestLoginLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <MailCheck className="size-8 text-primary" />
        <p className="font-medium">Check your inbox</p>
        <p className="text-sm text-muted-foreground">
          We sent a login link to <strong>{state.email}</strong>. It is valid for 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1 text-xs/relaxed font-medium text-muted-foreground">
        TUM e-mail address
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.email}
          placeholder="ge12abc@mytum.de"
          className="h-9 rounded-md border border-input bg-input/20 px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </label>
      {state.status === "error" && <p className="text-xs/relaxed text-destructive">{state.message}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send login link"}
      </Button>
    </form>
  );
}
