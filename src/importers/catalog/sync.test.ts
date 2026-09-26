import { describe, expect, it } from "vitest";

import { planCatalogSync } from "./sync";

const t = (iso: string) => Date.parse(iso);

describe("planCatalogSync", () => {
  const list = [
    { course_id: 1, modified_tumonline: "2026-08-01T10:00:00+02:00" }, // unchanged
    { course_id: 2, modified_tumonline: "2026-09-01T10:00:00+02:00" }, // changed since last import
    { course_id: 3, modified_tumonline: "2026-09-01T10:00:00+02:00" }, // new
    { course_id: 4, modified_tumonline: null }, // no timestamp → always refresh
    { course_id: 1, modified_tumonline: "2026-08-01T10:00:00+02:00" }, // duplicate on a page boundary
  ];
  const stored = new Map<number, number | null>([
    [1, t("2026-08-01T10:00:00+02:00")],
    [2, t("2026-08-15T10:00:00+02:00")],
    [4, t("2026-08-15T10:00:00+02:00")],
    [9, t("2026-08-15T10:00:00+02:00")], // gone from TUMonline
  ]);

  it("fetches only new or changed courses and removes vanished ones", () => {
    expect(planCatalogSync(list, stored)).toEqual({ fetch: [2, 3, 4], remove: [9], unchanged: 1 });
  });

  it("refetches everything with force", () => {
    expect(planCatalogSync(list, stored, { force: true }).fetch).toEqual([1, 2, 3, 4]);
  });

  it("refetches courses stored without a timestamp (older imports)", () => {
    expect(planCatalogSync([{ course_id: 5, modified_tumonline: "2026-01-01T00:00:00Z" }], new Map([[5, null]])).fetch).toEqual([5]);
  });
});
