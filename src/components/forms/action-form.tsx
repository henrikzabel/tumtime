"use client";

import { startTransition, useActionState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/clubs/actions";

/** A form bound to a server action returning ActionState, with inline success/error messages. */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  className,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode | ((state: ActionState) => ReactNode);
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      // Submit via onSubmit instead of `action` so React doesn't reset the inputs after an error.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className={className ?? "space-y-3"}
    >
      {typeof children === "function" ? children(state) : children}
      {state.error && (
        <p className="text-xs/relaxed text-destructive">{state.error}</p>
      )}
      {state.message && (
        <p className="text-xs/relaxed text-primary">{state.message}</p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
