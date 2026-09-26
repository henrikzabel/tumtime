import { COMMITMENT_BUCKETS, matchesCommitment, type Audience, type CommitmentBucket, type Language, type RecruitmentMode } from "./profile";

/** One club in the directory list (all clubs are sent to the client and filtered there). */
export type ClubListItem = {
  slug: string;
  name: string;
  summary: string | null;
  tagline: string | null;
  focusAreas: string[];
  locations: string[];
  imageUrl: string | null;
  hoursMin: number | null;
  hoursMax: number | null;
  languages: Language[];
  audience: Audience[];
  feeEuros: number | null;
  memberCount: number | null;
  recruitment: RecruitmentMode | null;
  /** An open sign-up form exists. */
  recruiting: boolean;
  claimed: boolean;
  /** ISO timestamp of the next info session, if any. */
  nextInfoSession: string | null;
  /** ISO timestamp of the nearest open form deadline, if any. */
  nextDeadline: string | null;
  openRoles: number;
};

export const CLUB_SORTS = {
  recommended: "Recommended",
  name: "A–Z",
  hours: "Least time first",
  deadline: "Deadline soonest",
  size: "Largest first",
} as const;
export type ClubSort = keyof typeof CLUB_SORTS;

export type ClubFilters = {
  q: string;
  area: string | null;
  campus: string | null;
  hours: CommitmentBucket[];
  language: Language | null;
  audience: Audience | null;
  free: boolean;
  recruiting: boolean;
  infoSession: boolean;
  sort: ClubSort;
};

export const DEFAULT_CLUB_FILTERS: ClubFilters = {
  q: "",
  area: null,
  campus: null,
  hours: [],
  language: null,
  audience: null,
  free: false,
  recruiting: false,
  infoSession: false,
  sort: "recommended",
};

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");

/** Recruiting now = an open form, or the club says it takes new members any time. */
export const isRecruiting = (c: ClubListItem) => c.recruiting || c.recruitment === "anytime";

/** How complete a profile is; used to rank richer profiles higher. */
function richness(c: ClubListItem): number {
  return (
    Number(c.claimed) +
    Number(c.hoursMin !== null || c.hoursMax !== null) +
    Number(c.languages.length > 0) +
    Number(c.audience.length > 0) +
    Number(!!c.tagline)
  );
}

export function filterClubs(clubs: ClubListItem[], f: ClubFilters): ClubListItem[] {
  const q = normalize(f.q.trim());
  const out = clubs.filter(
    (c) =>
      (!q || normalize(`${c.name} ${c.tagline ?? ""} ${c.summary ?? ""} ${c.focusAreas.join(" ")}`).includes(q)) &&
      (!f.area || c.focusAreas.includes(f.area)) &&
      (!f.campus || c.locations.includes(f.campus)) &&
      (f.hours.length === 0 || f.hours.some((b) => matchesCommitment(c.hoursMin, c.hoursMax, b))) &&
      (!f.language || c.languages.includes(f.language)) &&
      (!f.audience || c.audience.includes(f.audience)) &&
      (!f.free || c.feeEuros === 0) &&
      (!f.recruiting || isRecruiting(c)) &&
      (!f.infoSession || c.nextInfoSession !== null),
  );
  const byName = (a: ClubListItem, b: ClubListItem) => a.name.localeCompare(b.name);
  const nullsLast = (a: number | string | null, b: number | string | null) =>
    a === null ? (b === null ? 0 : 1) : b === null ? -1 : a < b ? -1 : a > b ? 1 : 0;
  const sorters: Record<ClubSort, (a: ClubListItem, b: ClubListItem) => number> = {
    recommended: (a, b) =>
      Number(isRecruiting(b)) - Number(isRecruiting(a)) ||
      Number(b.nextInfoSession !== null) - Number(a.nextInfoSession !== null) ||
      richness(b) - richness(a) ||
      byName(a, b),
    name: byName,
    hours: (a, b) => nullsLast(a.hoursMin ?? a.hoursMax, b.hoursMin ?? b.hoursMax) || byName(a, b),
    deadline: (a, b) => nullsLast(a.nextDeadline, b.nextDeadline) || byName(a, b),
    size: (a, b) => nullsLast(a.memberCount === null ? null : -a.memberCount, b.memberCount === null ? null : -b.memberCount) || byName(a, b),
  };
  return out.sort(sorters[f.sort]);
}

// --- URL <-> filters -----------------------------------------------------------------------------

const BUCKETS = COMMITMENT_BUCKETS.map((b) => b.value) as string[];

export function clubFiltersFromParams(p: URLSearchParams): ClubFilters {
  const sort = p.get("sort");
  return {
    q: p.get("q") ?? "",
    area: p.get("area"),
    campus: p.get("campus"),
    hours: (p.get("hours") ?? "").split(",").filter((h): h is CommitmentBucket => BUCKETS.includes(h)),
    language: (["en", "de"].includes(p.get("lang") ?? "") ? p.get("lang") : null) as Language | null,
    audience: (p.get("for") as Audience | null) ?? null,
    free: p.get("free") === "1",
    recruiting: p.get("recruiting") === "1",
    infoSession: p.get("info") === "1",
    sort: sort && sort in CLUB_SORTS ? (sort as ClubSort) : "recommended",
  };
}

export function clubFiltersToParams(f: ClubFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.area) p.set("area", f.area);
  if (f.campus) p.set("campus", f.campus);
  if (f.hours.length) p.set("hours", f.hours.join(","));
  if (f.language) p.set("lang", f.language);
  if (f.audience) p.set("for", f.audience);
  if (f.free) p.set("free", "1");
  if (f.recruiting) p.set("recruiting", "1");
  if (f.infoSession) p.set("info", "1");
  if (f.sort !== "recommended") p.set("sort", f.sort);
  return p;
}
