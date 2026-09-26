"use client";

import { startTransition, useActionState } from "react";

import { FormFields } from "@/components/clubs/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitApplication, type ActionState } from "@/lib/clubs/actions";
import type { FormField } from "@/lib/clubs/forms";

export function ApplyForm({
  slug,
  formId,
  clubName,
  fields,
  defaultName,
  email,
}: {
  slug: string;
  formId: number;
  clubName: string;
  fields: FormField[];
  defaultName: string;
  email: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    submitApplication.bind(null, slug, formId),
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <form
      // Submit via onSubmit instead of `action` so React doesn't reset the inputs after an error.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Your name<span className="text-destructive"> *</span>
          </span>
          <Input
            name="applicant_name"
            defaultValue={defaultName}
            required
            maxLength={120}
            aria-invalid={!!errors.applicant_name || undefined}
          />
          {errors.applicant_name && (
            <span className="text-xs/relaxed text-destructive">
              {errors.applicant_name}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">E-mail</span>
          <Input value={email} disabled readOnly />
        </label>
      </div>
      <FormFields fields={fields} errors={errors} />
      <div className="rounded-md bg-muted/60 p-3 text-xs/relaxed text-muted-foreground">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            name="privacy"
            required
            className="mt-0.5 size-4 accent-[var(--primary)]"
          />
          <span>
            I agree that my name, e-mail address and answers are shared with{" "}
            <strong>{clubName}</strong> for this application. Applications are
            deleted automatically after 6 months; I can withdraw mine at any
            time in my account.
          </span>
        </label>
        {errors.privacy && (
          <p className="mt-1 text-destructive">{errors.privacy}</p>
        )}
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send application"}
      </Button>
    </form>
  );
}
