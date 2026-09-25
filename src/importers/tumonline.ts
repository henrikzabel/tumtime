import * as cheerio from "cheerio";

import { examRecordSchema, type ExamRecord, type ExamType } from "@/lib/stats/exam-record";
import { computeStats, normalizeGrade } from "@/lib/stats/grades";
import { parseSemester } from "@/lib/stats/semester";

/**
 * Parser for the TUMonline "exam statistics" page (Angular UI, `<xm-exam-statistics>`), saved by
 * a student via "Save page as…" or copied from the browser's DOM inspector.
 *
 * Privacy: the saved page contains the uploader's name in the header. We only ever read inside the
 * `<xm-exam-statistics>` element and return aggregated numbers; the HTML itself is never stored.
 */
export const TUMONLINE_PARSER_VERSION = "tumonline-2026.1";

export class TumOnlineParseError extends Error {}

export type TumOnlineParseResult = {
  record: ExamRecord;
  /** Raw title, e.g. "WI001057EM FA 25S  Campus Munich: Cost Accounting". */
  title: string;
  /** Exam number as shown in the title (may carry a suffix, e.g. "WI001057EM"). */
  examCode: string;
  /** Exam type cannot be read reliably from the page; the uploader confirms it. */
  typeGuess: ExamType;
  warnings: string[];
};

type Category =
  | { kind: "grade"; grade: string }
  | { kind: "noShow" | "withdrawn" | "cheating" }
  | { kind: "unknown"; label: string };

/** Map a y-axis label ("1,3 sehr gut", "X Nicht erschienen - 5,0 …", "Q Rücktritt …") to a category. */
export function categorizeLabel(label: string): Category {
  const text = label.trim();
  const first = text.split(/\s+/)[0] ?? "";
  const grade = normalizeGrade(first);
  if (grade && /^[1-5]([.,]\d)?$/.test(first)) return { kind: "grade", grade };
  switch (first.toUpperCase()) {
    case "X":
      return { kind: "noShow" }; // Nicht erschienen / did not attend
    case "Q":
      return { kind: "withdrawn" }; // Rücktritt mit anerkanntem Grund / withdrawal with approved reason
    case "U":
      return { kind: "cheating" }; // Unterschleif / cheating
    case "B":
      return { kind: "grade", grade: "B" }; // bestanden / passed
    case "N":
      return { kind: "grade", grade: "N" }; // nicht bestanden / failed
  }
  if (/nicht erschienen|did not (attend|appear)|no[- ]show/i.test(text)) return { kind: "noShow" };
  if (/rücktritt|withdraw/i.test(text)) return { kind: "withdrawn" };
  if (/unterschleif|täuschung|cheat|fraud/i.test(text)) return { kind: "cheating" };
  if (/^nicht bestanden|^not passed|^failed/i.test(text)) return { kind: "grade", grade: "N" };
  if (/^bestanden|^passed/i.test(text)) return { kind: "grade", grade: "B" };
  return { kind: "unknown", label: text };
}

/** "1041", "7.37%", "7,37 %", "2.50" → number */
function parseNumber(text: string): number | undefined {
  const cleaned = text.replace(/[%\s ]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return undefined;
  return Number(cleaned);
}

function translateY(transform: string | undefined): number | undefined {
  const m = /translate\(\s*[-\d.]+\s*,\s*([-\d.]+)\s*\)/.exec(transform ?? "");
  return m ? Number(m[1]) : undefined;
}

/** Vertical centre of a horizontal Plotly bar path "M0,665.53V629.8H8V665.53Z". */
function barCenterY(d: string | undefined): number | undefined {
  const m = /M\s*[-\d.]+\s*,\s*([-\d.]+)\s*V\s*([-\d.]+)/.exec(d ?? "");
  return m ? (Number(m[1]) + Number(m[2])) / 2 : undefined;
}

/** Parse the exam title: "<exam code> <kind> <semester>  [Campus X: ]<module name>". */
export function parseTitle(title: string) {
  const m = /^\s*([A-Z]{2,5}\d[A-Z0-9_-]*)\s+(?:(\S+)\s+)?(\d{2}[WS]|\d{4}\s*(?:WS|SS))\s+(.+?)\s*$/i.exec(title);
  if (!m) return null;
  const examCode = m[1].toUpperCase();
  // Module numbers are letters followed by digits; TUMonline may append an exam suffix ("…EM").
  const moduleCode = /^[A-Z]+\d+/.exec(examCode)?.[0] ?? examCode;
  const semester = parseSemester(m[3]);
  const rest = m[4];
  const campus = /^(Campus [^:]+):\s*(.+)$/i.exec(rest);
  return {
    examCode,
    moduleCode,
    kind: m[2] ?? null,
    semester,
    campus: campus?.[1] ?? null,
    moduleName: (campus?.[2] ?? rest).trim(),
  };
}

export function parseTumOnlineStatistics(html: string): TumOnlineParseResult {
  const $ = cheerio.load(html);
  const root = $("xm-exam-statistics").first();
  if (root.length === 0) {
    throw new TumOnlineParseError(
      "This does not look like a TUMonline exam statistics page (no statistics block found).",
    );
  }
  const warnings: string[] = [];

  // --- Title -----------------------------------------------------------------------------------
  const title = root.find("h2").first().text().replace(/\s+/g, " ").trim();
  const parsedTitle = parseTitle(title);
  if (!parsedTitle) throw new TumOnlineParseError(`Could not read module number and semester from "${title}".`);
  if (!parsedTitle.semester) throw new TumOnlineParseError(`Unknown semester in "${title}".`);

  // --- Key figures (label → value pairs) -------------------------------------------------------
  const figures: { label: string; value: number | undefined }[] = [];
  root.find("label").each((_, el) => {
    const label = $(el).text().replace(/\s+/g, " ").trim();
    const valueCell = $(el).parent().next();
    if (!valueCell.length || valueCell.find("label").length) return;
    figures.push({ label, value: parseNumber(valueCell.text()) });
  });
  const figure = (re: RegExp) => figures.find((f) => re.test(f.label))?.value;
  const registered = figure(/^(registered|angemeldet)/i);
  const attempted = figure(/^(attempt|antritt|prüfungsantritt)/i);
  const failedPercent = figure(/(failed|negativ|nicht bestanden)/i);
  const averageTotal = figure(/^(average total|durchschnitt gesamt|notendurchschnitt gesamt)/i);
  const averagePassed = figure(/(assessed as passed|positiv)/i);

  // --- Distribution: pair every bar with the y-axis label at the same height --------------------
  const plotOffsetY = translateY(root.find("g.plot").first().attr("transform")) ?? 0;
  const ticks = root
    .find("g.yaxislayer-above g.ytick text")
    .toArray()
    .map((el) => ({
      label: $(el).attr("data-unformatted") ?? $(el).text(),
      y: translateY($(el).attr("transform")),
    }));
  const bars = root
    .find("g.trace.bars g.point")
    .toArray()
    .map((el) => {
      const text = $(el).find("text").attr("data-unformatted") ?? $(el).find("text").text();
      const count = /#\s*(\d+)/.exec(text)?.[1];
      const center = barCenterY($(el).find("path").attr("d"));
      return { count: count ? Number(count) : undefined, y: center === undefined ? undefined : center + plotOffsetY };
    });
  if (bars.length === 0 || ticks.length === 0) {
    throw new TumOnlineParseError(
      "No grade distribution found. Open the statistics page, wait until the chart is visible, then save it.",
    );
  }

  const pairs: { label: string; count: number }[] = [];
  const canMatchByPosition = bars.every((b) => b.y !== undefined) && ticks.every((t) => t.y !== undefined);
  bars.forEach((bar, i) => {
    if (bar.count === undefined) {
      warnings.push(`Bar ${i + 1} has no readable count.`);
      return;
    }
    let tick = ticks[i];
    if (canMatchByPosition) {
      tick = ticks.reduce((best, t) => (Math.abs(t.y! - bar.y!) < Math.abs(best.y! - bar.y!) ? t : best));
    } else if (bars.length !== ticks.length) {
      throw new TumOnlineParseError("Chart bars and labels do not line up.");
    }
    pairs.push({ label: tick.label, count: bar.count });
  });

  const grades: Record<string, number> = {};
  let noShow = 0;
  let withdrawn = 0;
  let cheating = 0;
  for (const { label, count } of pairs) {
    const cat = categorizeLabel(label);
    if (cat.kind === "grade") grades[cat.grade] = (grades[cat.grade] ?? 0) + count;
    else if (cat.kind === "noShow") noShow += count;
    else if (cat.kind === "withdrawn") withdrawn += count;
    else if (cat.kind === "cheating") cheating += count;
    else warnings.push(`Unrecognised category "${cat.label}" (${count}) was ignored.`);
  }

  // --- Consistency checks ----------------------------------------------------------------------
  const stats = computeStats(grades);
  if (attempted !== undefined && stats.attempted !== attempted) {
    warnings.push(`Distribution sums to ${stats.attempted} attempts, but the page says ${attempted}.`);
  }
  if (registered !== undefined && registered !== stats.attempted + noShow + withdrawn + cheating) {
    warnings.push(
      `Registered (${registered}) ≠ attempts + no-shows + withdrawals + cheating (${stats.attempted + noShow + withdrawn + cheating}).`,
    );
  }
  if (failedPercent !== undefined && stats.failureRate !== null && Math.abs(stats.failureRate * 100 - failedPercent) > 0.05) {
    warnings.push(`Failure rate on the page (${failedPercent}%) differs from the distribution.`);
  }
  if (averageTotal !== undefined && stats.averageTotal !== null && Math.abs(stats.averageTotal - averageTotal) > 0.01) {
    warnings.push(`Average on the page (${averageTotal}) differs from the distribution.`);
  }

  const typeGuess: ExamType = /wiederhol|retake|repeat/i.test(title) ? "retake" : "endterm";
  const record = examRecordSchema.parse({
    moduleCode: parsedTitle.moduleCode,
    moduleName: parsedTitle.moduleName,
    moduleNameLang: "en",
    semester: parsedTitle.semester,
    type: typeGuess,
    registered,
    attempted: attempted ?? stats.attempted,
    noShow,
    withdrawn,
    cheating,
    averageTotal,
    averagePassed,
    failureRate: failedPercent !== undefined ? failedPercent / 100 : undefined,
    grades,
  }) as ExamRecord;

  return { record, title, examCode: parsedTitle.examCode, typeGuess, warnings };
}
