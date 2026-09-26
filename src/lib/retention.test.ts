import { describe, expect, it } from "vitest";

import { retentionCutoff } from "./retention";

describe("retentionCutoff", () => {
  it("is six months before now", () => {
    expect(retentionCutoff(new Date("2027-06-15T12:00:00Z")).toISOString()).toBe("2026-12-15T12:00:00.000Z");
  });
});
