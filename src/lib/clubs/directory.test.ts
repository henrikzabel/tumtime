import { describe, expect, it } from "vitest";

import { clubFiltersFromParams, clubFiltersToParams, DEFAULT_CLUB_FILTERS, filterClubs, type ClubListItem } from "./directory";

const club = (name: string, extra: Partial<ClubListItem> = {}): ClubListItem => ({
  slug: name.toLowerCase(),
  name,
  summary: null,
  tagline: null,
  focusAreas: [],
  locations: [],
  imageUrl: null,
  hoursMin: null,
  hoursMax: null,
  languages: [],
  audience: [],
  feeEuros: null,
  memberCount: null,
  recruitment: null,
  recruiting: false,
  claimed: false,
  nextInfoSession: null,
  nextDeadline: null,
  openRoles: 0,
  ...extra,
});

const clubs = [
  club("Akaflieg", { hoursMin: 10, hoursMax: 20, languages: ["de"], focusAreas: ["Technology"], memberCount: 60 }),
  club("Bits & Bytes", { hoursMin: 2, hoursMax: 4, languages: ["en", "de"], feeEuros: 0, recruiting: true, memberCount: 200 }),
  club("Chor", { recruitment: "anytime", nextInfoSession: "2026-10-13T16:00:00.000Z", locations: ["München"] }),
  club("Délégation", { audience: ["exchange"] }),
];
const names = (f: Partial<typeof DEFAULT_CLUB_FILTERS>) => filterClubs(clubs, { ...DEFAULT_CLUB_FILTERS, ...f }).map((c) => c.name);

describe("filterClubs", () => {
  it("filters by hours, language, fee and audience", () => {
    expect(names({ hours: ["light"] })).toEqual(["Bits & Bytes"]);
    expect(names({ hours: ["light", "intense"], sort: "name" })).toEqual(["Akaflieg", "Bits & Bytes"]);
    expect(names({ language: "de", sort: "name" })).toEqual(["Akaflieg", "Bits & Bytes"]);
    expect(names({ free: true })).toEqual(["Bits & Bytes"]);
    expect(names({ audience: "exchange" })).toEqual(["Délégation"]);
  });
  it("searches accent-insensitively", () => {
    expect(names({ q: "delegation" })).toEqual(["Délégation"]);
  });
  it("treats join-any-time clubs as recruiting and ranks them first", () => {
    expect(names({ recruiting: true, sort: "name" })).toEqual(["Bits & Bytes", "Chor"]);
    expect(names({}).slice(0, 2)).toEqual(["Chor", "Bits & Bytes"]);
    expect(names({ infoSession: true })).toEqual(["Chor"]);
  });
  it("sorts by size and time, unknown values last", () => {
    expect(names({ sort: "size" })).toEqual(["Bits & Bytes", "Akaflieg", "Chor", "Délégation"]);
    expect(names({ sort: "hours" })).toEqual(["Bits & Bytes", "Akaflieg", "Chor", "Délégation"]);
  });
  it("round-trips through URL params", () => {
    const f = { ...DEFAULT_CLUB_FILTERS, q: "robo", hours: ["light" as const], language: "en" as const, free: true, sort: "hours" as const };
    expect(clubFiltersFromParams(clubFiltersToParams(f))).toEqual(f);
  });
});
