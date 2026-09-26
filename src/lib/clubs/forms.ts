import { z } from "zod";

/*
 * Custom sign-up forms. A club defines a list of fields; applicants' answers are validated
 * against that definition on the server.
 */

export const FIELD_TYPES = {
  short_text: "Short text",
  long_text: "Long text",
  email: "E-mail",
  url: "Link (URL)",
  number: "Number",
  date: "Date",
  single_choice: "Single choice",
  multi_choice: "Multiple choice",
  checkbox: "Checkbox (yes/no)",
} as const;
export type FieldType = keyof typeof FIELD_TYPES;

export const CHOICE_TYPES: FieldType[] = ["single_choice", "multi_choice"];
export const MAX_FIELDS = 40;

export const formFieldSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]{4,24}$/),
    type: z.enum(Object.keys(FIELD_TYPES) as [FieldType, ...FieldType[]]),
    label: z.string().trim().min(1, "Every field needs a label").max(200),
    help: z.string().trim().max(500).optional(),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  })
  .superRefine((f, ctx) => {
    if (CHOICE_TYPES.includes(f.type) && (f.options?.length ?? 0) < 2) {
      ctx.addIssue({ code: "custom", message: `"${f.label}" needs at least two options`, path: ["options"] });
    }
    if (f.options && new Set(f.options).size !== f.options.length) {
      ctx.addIssue({ code: "custom", message: `"${f.label}" has duplicate options`, path: ["options"] });
    }
  });
export type FormField = z.infer<typeof formFieldSchema>;

export const formFieldsSchema = z
  .array(formFieldSchema)
  .max(MAX_FIELDS, `At most ${MAX_FIELDS} fields`)
  .refine((fields) => new Set(fields.map((f) => f.id)).size === fields.length, "Field ids must be unique");

export function newFieldId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(6, "0");
}

export type Answer = string | string[] | boolean;
export type Answers = Record<string, Answer>;

const LIMITS: Partial<Record<FieldType, number>> = { short_text: 300, long_text: 5000, email: 254, url: 500 };

/** Read raw answers for the given fields from a submitted form. */
export function answersFromFormData(fields: FormField[], data: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const f of fields) {
    const key = `field_${f.id}`;
    if (f.type === "multi_choice") raw[f.id] = data.getAll(key).map(String);
    else if (f.type === "checkbox") raw[f.id] = data.get(key) === "on";
    else raw[f.id] = data.get(key) === null ? "" : String(data.get(key));
  }
  return raw;
}

export type ValidationResult = { ok: true; answers: Answers } | { ok: false; errors: Record<string, string> };

export function validateAnswers(fields: FormField[], raw: Record<string, unknown>): ValidationResult {
  const answers: Answers = {};
  const errors: Record<string, string> = {};

  for (const f of fields) {
    const value = raw[f.id];
    if (f.type === "checkbox") {
      const checked = value === true;
      if (f.required && !checked) errors[f.id] = "Please confirm.";
      answers[f.id] = checked;
      continue;
    }
    if (f.type === "multi_choice") {
      const list = Array.isArray(value) ? value.map(String) : [];
      if (list.some((v) => !f.options?.includes(v))) errors[f.id] = "Invalid option.";
      else if (f.required && list.length === 0) errors[f.id] = "Please choose at least one option.";
      answers[f.id] = [...new Set(list)];
      continue;
    }

    const text = typeof value === "string" ? value.trim() : "";
    if (!text) {
      if (f.required) errors[f.id] = "This field is required.";
      answers[f.id] = "";
      continue;
    }
    const limit = LIMITS[f.type];
    if (limit && text.length > limit) {
      errors[f.id] = `At most ${limit} characters.`;
    } else if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      errors[f.id] = "Please enter a valid e-mail address.";
    } else if (f.type === "url" && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(text)) {
      errors[f.id] = "Please enter a link starting with https://";
    } else if (f.type === "number" && !/^-?\d+([.,]\d+)?$/.test(text)) {
      errors[f.id] = "Please enter a number.";
    } else if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      errors[f.id] = "Please enter a date.";
    } else if (f.type === "single_choice" && !f.options?.includes(text)) {
      errors[f.id] = "Invalid option.";
    }
    answers[f.id] = text;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, answers };
}

/** Human-readable answer for dashboards and e-mails. */
export function formatAnswer(field: FormField, answer: Answer | undefined): string {
  if (answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0)) return "—";
  if (typeof answer === "boolean") return answer ? "Yes" : "No";
  return Array.isArray(answer) ? answer.join(", ") : answer;
}

/** A sensible starting form for new clubs. */
export function defaultFields(): FormField[] {
  return [
    { id: newFieldId(), type: "short_text", label: "Study program and semester", required: true },
    { id: newFieldId(), type: "long_text", label: "Why do you want to join us?", required: true },
    { id: newFieldId(), type: "url", label: "LinkedIn or portfolio (optional)", required: false },
  ];
}
