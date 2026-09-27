import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { parseTumOnlineStatistics } from "@/importers/tumonline";

import { extractStatisticsBlock } from "./extract";
import { parseUpload, UploadError } from "./submissions";

const fixture = readFileSync(path.join(__dirname, "../../importers/__fixtures__/tumonline-exam-statistics.en.html"), "utf8");

describe("extractStatisticsBlock", () => {
  const block = extractStatisticsBlock(fixture)!;

  it("keeps only the statistics element", () => {
    expect(block.startsWith("<xm-exam-statistics")).toBe(true);
    expect(block.endsWith("</xm-exam-statistics>")).toBe(true);
  });

  it("drops the header with the uploader's name", () => {
    expect(fixture).toContain("Mustermann");
    expect(block).not.toContain("Mustermann");
  });

  it("parses to the same numbers as the full page", () => {
    expect(parseTumOnlineStatistics(block)).toEqual(parseTumOnlineStatistics(fixture));
  });

  it("returns null for other pages and cut-off files", () => {
    expect(extractStatisticsBlock("<html><body>Login</body></html>")).toBeNull();
    expect(extractStatisticsBlock("<xm-exam-statistics-page></xm-exam-statistics-page>")).toBeNull();
    expect(extractStatisticsBlock(block.slice(0, 500))).toBeNull();
  });
});

describe("parseUpload", () => {
  it("returns the parsed record for a full page or a block", () => {
    const res = parseUpload(extractStatisticsBlock(fixture)!);
    expect(res.record).toMatchObject({ moduleCode: "WI001057", semester: "2025SS", attempted: 895 });
    expect(res.examCode).toBe("WI001057EM");
  });

  it("explains how to save the page when the block is missing", () => {
    expect(() => parseUpload("<html></html>")).toThrow(UploadError);
    expect(() => parseUpload("<html></html>")).toThrow(/Save page as/);
  });

  it("turns parser errors into upload errors", () => {
    const noChart = fixture.replace(/<plotly-plot[\s\S]*<\/plotly-plot>/, "");
    expect(() => parseUpload(noChart)).toThrow(UploadError);
  });
});
