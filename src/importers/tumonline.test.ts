import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { categorizeLabel, parseTitle, parseTumOnlineStatistics, TumOnlineParseError } from "./tumonline";

const fixture = readFileSync(path.join(__dirname, "__fixtures__/tumonline-exam-statistics.en.html"), "utf8");

describe("parseTumOnlineStatistics (English UI, 2026)", () => {
  const result = parseTumOnlineStatistics(fixture);

  it("reads module, semester and name from the title", () => {
    expect(result.examCode).toBe("WI001057EM");
    expect(result.record).toMatchObject({
      moduleCode: "WI001057",
      moduleName: "Cost Accounting",
      semester: "2025SS",
      type: "endterm",
    });
  });

  it("reads the key figures", () => {
    expect(result.record).toMatchObject({
      registered: 1041,
      attempted: 895,
      averageTotal: 2.66,
      averagePassed: 2.5,
    });
    expect(result.record.failureRate).toBeCloseTo(0.0737, 4);
  });

  it("pairs every bar with its label", () => {
    expect(result.record.grades).toEqual({
      "1.0": 22,
      "1.3": 64,
      "1.7": 76,
      "2.0": 112,
      "2.3": 138,
      "2.7": 147,
      "3.0": 104,
      "3.3": 92,
      "3.7": 52,
      "4.0": 22,
      "4.3": 24,
      "4.7": 13,
      "5.0": 29,
    });
    expect(result.record.noShow).toBe(144);
    expect(result.record.withdrawn).toBe(2);
    expect(result.record.cheating).toBe(0);
  });

  it("finds the page internally consistent", () => {
    expect(result.warnings).toEqual([]);
  });

  it("never extracts the uploader's name", () => {
    expect(JSON.stringify(result)).not.toContain("Mustermann");
  });

  it("pairs by position even if bars come in a different order than labels", () => {
    // Reverse the DOM order of the bars; the positional match must still pair them correctly.
    const points = fixture.match(/<g class="point">.*?<\/g>/g)!;
    const shuffled = fixture.replace(points.join("\n"), [...points].reverse().join("\n"));
    expect(shuffled).not.toBe(fixture);
    expect(parseTumOnlineStatistics(shuffled).record.grades).toEqual(result.record.grades);
  });

  it("warns when numbers do not add up", () => {
    const tampered = fixture.replace('data-unformatted="7.15% #64"', 'data-unformatted="7.15% #65"');
    const { warnings } = parseTumOnlineStatistics(tampered);
    expect(warnings.some((w) => w.includes("896"))).toBe(true);
  });

  it("rejects pages without a statistics block", () => {
    expect(() => parseTumOnlineStatistics("<html><body>Login</body></html>")).toThrow(TumOnlineParseError);
  });

  it("rejects pages saved before the chart rendered", () => {
    const noChart = fixture.replace(/<plotly-plot[\s\S]*<\/plotly-plot>/, "");
    expect(() => parseTumOnlineStatistics(noChart)).toThrow(/No grade distribution/);
  });
});

describe("categorizeLabel", () => {
  it.each([
    ["1,0 sehr gut", { kind: "grade", grade: "1.0" }],
    ["4,3 nicht ausreichend", { kind: "grade", grade: "4.3" }],
    ["X Nicht erschienen - 5,0 nicht ausreichend", { kind: "noShow" }],
    ["Q Rücktritt mit anerkanntem Grund - Q Keine Beurteilung", { kind: "withdrawn" }],
    ["U Unterschleif - 5,0 nicht ausreichend", { kind: "cheating" }],
    ["B bestanden", { kind: "grade", grade: "B" }],
    ["N nicht bestanden", { kind: "grade", grade: "N" }],
    ["Z Something new", { kind: "unknown", label: "Z Something new" }],
  ])("%s", (label, expected) => {
    expect(categorizeLabel(label)).toEqual(expected);
  });
});

describe("parseTitle", () => {
  it("handles titles without campus prefix", () => {
    expect(parseTitle("IN0001 FA 24W Introduction to Informatics")).toMatchObject({
      moduleCode: "IN0001",
      semester: "2024WS",
      moduleName: "Introduction to Informatics",
      campus: null,
    });
  });
});
