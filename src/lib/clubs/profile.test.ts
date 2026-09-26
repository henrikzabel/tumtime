import { describe, expect, it } from "vitest";

import { clubStructureSchema, descendantIds, formatHours, matchesCommitment, readProfile, roleTree, type ClubRole } from "./profile";

const role = (id: string, parentId: string | null, title = id): ClubRole => ({
  id,
  parentId,
  title,
  holder: "",
  description: "",
  open: false,
});

describe("time commitment", () => {
  it("matches buckets by overlapping ranges and skips clubs without data", () => {
    expect(matchesCommitment(2, 4, "light")).toBe(true);
    expect(matchesCommitment(2, 4, "moderate")).toBe(true);
    expect(matchesCommitment(2, 4, "committed")).toBe(false);
    expect(matchesCommitment(15, null, "intense")).toBe(true);
    expect(matchesCommitment(null, null, "light")).toBe(false);
  });
  it("formats ranges", () => {
    expect(formatHours(3, 5)).toBe("3–5 h/week");
    expect(formatHours(4, 4)).toBe("4 h/week");
    expect(formatHours(null, 6)).toBe("6 h/week");
    expect(formatHours(null, null)).toBeNull();
  });
});

describe("profile", () => {
  it("keeps valid sections when another one is invalid", () => {
    const p = readProfile({ faqs: [{ question: "Q?", answer: "A." }], facts: "broken" });
    expect(p.faqs).toHaveLength(1);
    expect(p.facts).toEqual([]);
  });
});

describe("structure", () => {
  it("builds a tree in stored order", () => {
    const tree = roleTree([role("pres", null), role("vp01", "pres"), role("tres", "pres"), role("team", "vp01")]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((c) => c.id)).toEqual(["vp01", "tres"]);
    expect(tree[0].children[0].children[0].id).toBe("team");
  });
  it("finds descendants", () => {
    const roles = [role("pres", null), role("vp01", "pres"), role("team", "vp01"), role("tres", null)];
    expect([...descendantIds(roles, "vp01")].sort()).toEqual(["team", "vp01"]);
  });
  it("rejects loops and dangling parents", () => {
    expect(clubStructureSchema.safeParse([role("aaaa", "bbbb"), role("bbbb", "aaaa")]).success).toBe(false);
    expect(clubStructureSchema.safeParse([role("aaaa", "zzzz")]).success).toBe(false);
    expect(clubStructureSchema.safeParse([role("aaaa", null), role("bbbb", "aaaa")]).success).toBe(true);
  });
});
