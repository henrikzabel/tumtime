import { ActionForm } from "@/components/forms/action-form";
import { Input, Label, Textarea } from "@/components/ui/input";
import { savePeriod } from "@/lib/clubs/info-session-actions";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type PeriodFormValues = {
  title: string;
  description: string;
  startsOn: string;
  endsOn: string;
  weekdays: number[];
  slots: string;
  venues: string;
};

export function PeriodForm({ id, initial }: { id: number | null; initial: PeriodFormValues }) {
  return (
    <ActionForm action={savePeriod.bind(null, id)} submitLabel={id ? "Save settings" : "Create period"}>
      <Label>
        Title
        <Input name="title" required maxLength={120} defaultValue={initial.title} />
      </Label>
      <Label>
        Description (shown on the public schedule)
        <Textarea name="description" rows={2} maxLength={2000} defaultValue={initial.description} className="min-h-0" />
      </Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label>
          First day
          <Input name="startsOn" type="date" required defaultValue={initial.startsOn} />
        </Label>
        <Label>
          Last day
          <Input name="endsOn" type="date" required defaultValue={initial.endsOn} />
        </Label>
      </div>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-1 text-xs/relaxed font-medium">Evenings with sessions</legend>
        {WEEKDAYS.map((d, i) => (
          <label key={d} className="flex items-center gap-1.5 text-xs/relaxed">
            <input type="checkbox" name="weekdays" value={i + 1} defaultChecked={initial.weekdays.includes(i + 1)} className="accent-[var(--primary)]" />
            {d}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label>
          Time slots (one per line, “18:00-18:45”)
          <Textarea name="slots" rows={4} defaultValue={initial.slots} className="min-h-0 font-mono text-xs" />
        </Label>
        <Label>
          Rooms in parallel (“Room | Campus | Capacity”)
          <Textarea name="venues" rows={4} defaultValue={initial.venues} className="min-h-0 font-mono text-xs" />
        </Label>
      </div>
    </ActionForm>
  );
}
