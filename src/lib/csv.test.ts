import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes separators, quotes and newlines", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
  });
  it("neutralises formulas", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+49 89")).toBe("'+49 89");
  });
  it("joins rows with CRLF", () => {
    expect(toCsv([["a", 1], ["b", 2]])).toBe("a,1\r\nb,2\r\n");
  });
});
