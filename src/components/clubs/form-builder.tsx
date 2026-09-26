"use client";

import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { FormFields } from "@/components/clubs/form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { deleteForm, saveForm, type ActionState } from "@/lib/clubs/actions";
import { CHOICE_TYPES, FIELD_TYPES, MAX_FIELDS, newFieldId, type FieldType, type FormField } from "@/lib/clubs/forms";

type Initial = { id: number | null; title: string; intro: string; status: string; closesAt: string; fields: FormField[] };

const selectCls =
  "h-8 rounded-md border border-input bg-input/20 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

export function FormBuilder({ slug, initial }: { slug: string; initial: Initial }) {
  const [fields, setFields] = useState<FormField[]>(initial.fields);
  const [title, setTitle] = useState(initial.title);
  const [intro, setIntro] = useState(initial.intro);
  // Controlled on purpose: React resets uncontrolled fields after a form action, which used to
  // flip the status back to "draft" so the next save silently hid an open form.
  const [status, setStatus] = useState(initial.status);
  const [closesAt, setClosesAt] = useState(initial.closesAt);
  const deadlinePassed = !!closesAt && closesAt < new Date().toISOString().slice(0, 10);
  const [state, action, pending] = useActionState<ActionState, FormData>(saveForm.bind(null, slug, initial.id), {});

  const update = (i: number, patch: Partial<FormField>) =>
    setFields((fs) => fs.map((f, k) => (k === i ? { ...f, ...patch } : f)));
  const move = (i: number, dir: -1 | 1) =>
    setFields((fs) => {
      const j = i + dir;
      if (j < 0 || j >= fs.length) return fs;
      const next = [...fs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const add = (type: FieldType) =>
    setFields((fs) => [
      ...fs,
      {
        id: newFieldId(),
        type,
        label: "",
        required: false,
        ...(CHOICE_TYPES.includes(type) ? { options: ["Option 1", "Option 2"] } : {}),
      },
    ]);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <form action={action} className="space-y-4">
        <input type="hidden" name="fields" value={JSON.stringify(fields)} />
        <Card>
          <CardContent className="space-y-3">
            <Label>
              Title
              <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
            </Label>
            <Label>
              Introduction (optional)
              <Textarea name="intro" value={intro} onChange={(e) => setIntro(e.target.value)} rows={3} maxLength={3000} />
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Label>
                Status
                <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                  <option value="draft">Draft (hidden)</option>
                  <option value="open">Open — accepting applications</option>
                  <option value="closed">Closed</option>
                </select>
              </Label>
              <Label>
                Deadline (optional)
                <Input name="closesAt" type="date" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
              </Label>
            </div>
            {(status !== "open" || deadlinePassed) && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs/relaxed text-muted-foreground">
                {status === "draft"
                  ? "Draft: students can't see this form. Set the status to “Open” and save to accept applications."
                  : status === "closed"
                    ? "Closed: this form doesn't accept applications."
                    : "The deadline has passed, so this form no longer accepts applications."}
              </p>
            )}
          </CardContent>
        </Card>

        {fields.map((f, i) => (
          <Card key={f.id} size="sm">
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs/relaxed font-medium text-muted-foreground">Question {i + 1}</span>
                <select
                  value={f.type}
                  onChange={(e) => {
                    const type = e.target.value as FieldType;
                    update(i, {
                      type,
                      options: CHOICE_TYPES.includes(type) ? (f.options?.length ? f.options : ["Option 1", "Option 2"]) : undefined,
                    });
                  }}
                  className={`${selectCls} ml-auto h-7 text-xs`}
                  aria-label="Question type"
                >
                  {Object.entries(FIELD_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  <ArrowUp />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label="Move down">
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setFields((fs) => [...fs.slice(0, i + 1), { ...f, id: newFieldId() }, ...fs.slice(i + 1)])}
                  aria-label="Duplicate"
                >
                  <Copy />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFields((fs) => fs.filter((_, k) => k !== i))} aria-label="Delete">
                  <Trash2 />
                </Button>
              </div>
              <Input value={f.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Question" maxLength={200} aria-label="Question text" />
              <Input
                value={f.help ?? ""}
                onChange={(e) => update(i, { help: e.target.value || undefined })}
                placeholder="Help text (optional)"
                maxLength={500}
                className="text-xs"
                aria-label="Help text"
              />
              {CHOICE_TYPES.includes(f.type) && (
                <Textarea
                  value={(f.options ?? []).join("\n")}
                  onChange={(e) => update(i, { options: e.target.value.split("\n").map((o) => o.trimStart()).slice(0, 30) })}
                  onBlur={() => update(i, { options: (f.options ?? []).map((o) => o.trim()).filter(Boolean) })}
                  rows={Math.min(8, Math.max(3, (f.options?.length ?? 0) + 1))}
                  className="min-h-0 text-xs"
                  placeholder="One option per line"
                  aria-label="Options"
                />
              )}
              <label className="flex items-center gap-2 text-xs/relaxed">
                <input type="checkbox" checked={f.required} onChange={(e) => update(i, { required: e.target.checked })} className="accent-[var(--primary)]" />
                Required
              </label>
            </CardContent>
          </Card>
        ))}

        {fields.length < MAX_FIELDS && (
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(FIELD_TYPES) as FieldType[]).map((t) => (
              <Button key={t} type="button" variant="outline" size="sm" onClick={() => add(t)}>
                <Plus /> {FIELD_TYPES[t]}
              </Button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 border-t pt-4">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Save form"}
          </Button>
          {state.error && <p className="text-xs/relaxed text-destructive">{state.error}</p>}
          {state.message && <p className="text-xs/relaxed text-primary">{state.message}</p>}
        </div>
      </form>

      <div className="space-y-3 lg:sticky lg:top-16 lg:self-start">
        <p className="text-xs/relaxed font-medium text-muted-foreground">Preview</p>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{title || "Untitled form"}</CardTitle>
            {intro && <CardDescription className="whitespace-pre-line">{intro}</CardDescription>}
          </CardHeader>
          <CardContent>
            <FormFields fields={fields.map((f) => ({ ...f, label: f.label || "Untitled question" }))} disabled />
          </CardContent>
        </Card>
        {initial.id && (
          <form
            action={deleteForm.bind(null, slug)}
            onSubmit={(e) => {
              if (!window.confirm("Delete this form and all its applications?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="formId" value={initial.id} />
            <Button type="submit" variant="destructive">
              <Trash2 /> Delete form
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
