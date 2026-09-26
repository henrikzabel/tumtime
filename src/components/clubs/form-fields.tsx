import { Input, Textarea } from "@/components/ui/input";
import type { FormField } from "@/lib/clubs/forms";
import { cn } from "@/lib/utils";

/** Renders the inputs of a custom sign-up form. Names are `field_<id>`, as read by answersFromFormData. */
export function FormFields({
  fields,
  errors = {},
  disabled = false,
}: {
  fields: FormField[];
  errors?: Record<string, string>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-5">
      {fields.map((f) => {
        const name = `field_${f.id}`;
        const error = errors[f.id];
        const labelEl = (
          <span className="text-sm font-medium">
            {f.label}
            {f.required && <span className="text-destructive"> *</span>}
          </span>
        );
        const help = f.help ? <span className="text-xs/relaxed font-normal text-muted-foreground">{f.help}</span> : null;
        const err = error ? <span className="text-xs/relaxed font-normal text-destructive">{error}</span> : null;

        if (f.type === "single_choice" || f.type === "multi_choice") {
          return (
            <fieldset key={f.id} className="space-y-1.5" disabled={disabled}>
              <legend className="mb-1">{labelEl}</legend>
              {help}
              {(f.options ?? []).map((o) => (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <input
                    type={f.type === "single_choice" ? "radio" : "checkbox"}
                    name={name}
                    value={o}
                    required={f.required && f.type === "single_choice"}
                    className="size-4 accent-[var(--primary)]"
                  />
                  {o}
                </label>
              ))}
              {err}
            </fieldset>
          );
        }
        if (f.type === "checkbox") {
          return (
            <div key={f.id} className="space-y-1">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name={name} required={f.required} disabled={disabled} className="mt-0.5 size-4 accent-[var(--primary)]" />
                <span>
                  {labelEl}
                  {help && <span className="block">{help}</span>}
                </span>
              </label>
              {err}
            </div>
          );
        }
        const common = { name, required: f.required, disabled, "aria-invalid": !!error || undefined };
        return (
          <label key={f.id} className={cn("flex flex-col gap-1")}>
            {labelEl}
            {help}
            {f.type === "long_text" ? (
              <Textarea {...common} rows={5} maxLength={5000} />
            ) : (
              <Input
                {...common}
                type={{ email: "email", url: "url", number: "text", date: "date", short_text: "text" }[f.type as "email"] ?? "text"}
                inputMode={f.type === "number" ? "decimal" : undefined}
                maxLength={f.type === "url" ? 500 : 300}
                placeholder={f.type === "url" ? "https://" : undefined}
              />
            )}
            {err}
          </label>
        );
      })}
    </div>
  );
}
