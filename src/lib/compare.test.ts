import { describe, expect, it } from "vitest";

import { parseCompareParam, serializeCompare } from "./compare";

describe("compare URL state", () => {
  it("round-trips items with and without selectors", () => {
    const param = "IN0001,IN0015:2023WS-endterm,MA0901:all";
    expect(serializeCompare(parseCompareParam(param))).toBe(param);
  });

  it("ignores invalid entries and caps at four", () => {
    expect(parseCompareParam("in0001:bogus,<script>,A1,IN1,IN2,IN3,IN4").map((i) => [i.code, i.selector])).toEqual([
      ["IN0001", null],
      ["IN1", null],
      ["IN2", null],
      ["IN3", null],
    ]);
  });
});
