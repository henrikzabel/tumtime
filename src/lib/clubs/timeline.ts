import { toBerlin } from "./info-sessions";
import type { ClubProfile, MilestoneKind } from "./profile";

export type TimelineItem = {
  date: string; // YYYY-MM-DD (Berlin)
  title: string;
  lines: string[];
  kind: MilestoneKind;
  state: "past" | "next" | "upcoming";
};

type Session = { startsAt: Date; endsAt: Date; venue: string | null; onlineUrl: string | null };
type Form = { title: string; closesAt: Date | null };

/**
 * The recruitment timeline of a club: its own milestones, info sessions and form deadlines, in
 * date order. The first item that hasn't passed yet is marked `next`.
 */
export function buildTimeline(profile: ClubProfile, sessions: Session[], forms: Form[], now = new Date()): TimelineItem[] {
  const today = toBerlin(now).date;
  const items: Omit<TimelineItem, "state">[] = [
    ...profile.timeline.map((m) => ({ date: m.date, title: m.title, lines: m.detail ? [m.detail] : [], kind: m.kind })),
    ...sessions.map((s, i) => {
      const start = toBerlin(s.startsAt);
      const end = toBerlin(s.endsAt);
      return {
        date: start.date,
        title: sessions.length > 1 ? `Info session #${i + 1}` : "Info session",
        lines: [s.venue ? `@${s.venue}` : "Online", `${start.time}–${end.time}`],
        kind: "info" as const,
      };
    }),
    ...forms
      .filter((f): f is Form & { closesAt: Date } => f.closesAt !== null)
      .map((f) => ({ date: toBerlin(f.closesAt).date, title: `${f.title} due`, lines: [toBerlin(f.closesAt).time], kind: "deadline" as const })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let nextFound = false;
  return items.map((it) => {
    if (it.date < today) return { ...it, state: "past" };
    if (!nextFound) {
      nextFound = true;
      return { ...it, state: "next" };
    }
    return { ...it, state: "upcoming" };
  });
}
