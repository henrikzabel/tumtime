"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { ActionState } from "@/lib/clubs/actions";

export type ListField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "url" | "date" | "select";
  placeholder?: string;
  maxLength?: number;
  options?: Record<string, string>;
  /** Grid column span out of 6 on wide screens (default 6). */
  span?: number;
};

type Item = Record<string, string>;

const SPANS: Record<number, string> = { 2: "sm:col-span-2", 3: "sm:col-span-3", 4: "sm:col-span-4", 6: "sm:col-span-6" };

const selectCls =
  "h-8 w-full rounded-md border border-input bg-input/20 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

/** Edit a list of small records (FAQs, projects, facts …) and save it as JSON in one go. */
export function ListEditor({
  action,
  fields,
  initial,
  addLabel,
  max,
  emptyText,
  extraField,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: ListField[];
  initial: Item[];
  addLabel: string;
  max: number;
  emptyText?: string;
  /** One additional plain text input saved with the list (e.g. the timeline's term label). */
  extraField?: { name: string; label: string; initial: string; placeholder?: string; maxLength?: number };
}) {
  const [items, setItems] = useState<Item[]>(initial);
  const [extra, setExtra] = useState(extraField?.initial ?? "");
  const [state, formAction, pending] = useActionState(action, {});
  const blank = () => Object.fromEntries(fields.map((f) => [f.key, f.type === "select" ? Object.keys(f.options ?? {})[0] ?? "" : ""]));
  const move = (i: number, dir: -1 | 1) =>
    setItems((xs) => {
      const j = i + dir;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <form
      // Submit via onSubmit instead of `action`: React resets forms after an action, which would snap
      // the controlled selects back to their first option.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-3"
    >
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      {extraField && (
        <Label className="max-w-xs">
          {extraField.label}
          <Input
            name={extraField.name}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder={extraField.placeholder}
            maxLength={extraField.maxLength}
          />
        </Label>
      )}
      {items.length === 0 && emptyText && <p className="text-xs/relaxed text-muted-foreground">{emptyText}</p>}
      {items.map((item, i) => (
        <div key={i} className="rounded-md p-3 ring-1 ring-foreground/10">
          <div className="grid gap-2 sm:grid-cols-6">
            {fields.map((f) => {
              const common = {
                value: item[f.key] ?? "",
                placeholder: f.placeholder,
                maxLength: f.maxLength,
                onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                  setItems((xs) => xs.map((x, k) => (k === i ? { ...x, [f.key]: e.target.value } : x))),
              };
              return (
                <Label key={f.key} className={SPANS[f.span ?? 6]}>
                  {f.label}
                  {f.type === "textarea" ? (
                    <Textarea rows={3} className="min-h-0" {...common} />
                  ) : f.type === "select" ? (
                    <select className={selectCls} {...common}>
                      {Object.entries(f.options ?? {}).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input type={f.type ?? "text"} {...common} />
                  )}
                </Label>
              );
            })}
          </div>
          <div className="mt-2 flex justify-end gap-1">
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
              <ArrowUp />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">
              <ArrowDown />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setItems((xs) => xs.filter((_, k) => k !== i))} aria-label="Remove">
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {items.length < max && (
          <Button type="button" variant="outline" onClick={() => setItems((xs) => [...xs, blank()])}>
            <Plus /> {addLabel}
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.error && <span className="text-xs/relaxed text-destructive">{state.error}</span>}
        {state.message && !pending && <span className="text-xs/relaxed text-primary">{state.message}</span>}
      </div>
    </form>
  );
}
