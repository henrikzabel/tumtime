import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";

import { parseSemester, type Semester } from "@/lib/stats/semester";

/**
 * Parser for the "Studienplan" pages of the TUM School of CIT, e.g.
 * https://www.cit.tum.de/cit/studium/studiengaenge/bachelor-informatik/studienplan/
 *
 * Each page holds one accordion section per starting cohort with a table (rows = semesters,
 * columns = subject areas) and footnotes that state additional requirements (electives,
 * Überfachliche Grundlagen, Anwendungsfach).
 */

export type StudyPlanEntry = {
  kind: "module" | "placeholder";
  /** Module number for concrete modules, e.g. "IN0015". */
  moduleCode?: string;
  title: string;
  credits: number;
  /** Column the entry sits in, e.g. "Informatik", "Mathematik". */
  area: string | null;
  /** Footnote markers attached to the entry, e.g. "*" for Grundlagenprüfung. */
  markers: string;
  /** Entries in the same cell joined by "oder" share a group number: pick one of them. */
  alternativeGroup?: number;
};

export type StudyPlanRequirement = { area: string; credits: number };

export type StudyPlan = {
  title: string;
  /** First and last starting semester this plan applies to (null = open-ended). */
  startFrom: Semester | null;
  startUntil: Semester | null;
  /** TUMonline curriculum id (pStpStpNr), if linked. */
  tumonlineCurriculumId: number | null;
  semesters: { number: number; credits: number | null; entries: StudyPlanEntry[] }[];
  footnotes: string[];
  requirements: StudyPlanRequirement[];
};

export type StudyPlanParseResult = { plans: StudyPlan[]; warnings: string[] };

const clean = (s: string) => s.replace(/­/g, "").replace(/\s+/g, " ").trim();

// One item: "IN0015 Diskrete Strukturen * 8 Credits" or "Wahlmodule Informatik *** 5 Credits".
const ITEM = /^(?:([A-Z]{2,5}\d[A-Z0-9_]*)\s+)?(.*?)\s*(\*+)?\s*(\d+(?:[.,]\d+)?)\s*Credits$/i;

/** Split the text of one table cell into plan entries. */
export function parseCell(text: string, area: string | null, nextGroup: () => number): StudyPlanEntry[] {
  const chunks = clean(text)
    .split(/(?<=\bCredits)\s*/i)
    .map((c) => c.trim())
    .filter(Boolean);
  const entries: StudyPlanEntry[] = [];
  for (const chunk of chunks) {
    // Items introduced by "oder" are alternatives to the previous item.
    const isAlternative = /^oder\b/i.test(chunk);
    const m = ITEM.exec(chunk.replace(/^oder\s+/i, ""));
    if (!m) continue;
    const [, code, rawTitle, markers, credits] = m;
    // "Wahlmodul Informatik" and "Wahlmodule Informatik" name the same elective area.
    const title = clean(rawTitle).replace(/^Wahlmodul(?=\s)/i, "Wahlmodule");
    if (!title && !code) continue;
    const entry: StudyPlanEntry = {
      kind: code ? "module" : "placeholder",
      ...(code ? { moduleCode: code } : {}),
      title,
      credits: Number(credits.replace(",", ".")),
      area,
      markers: markers ?? "",
    };
    const prev = entries.at(-1);
    if (isAlternative && prev) {
      prev.alternativeGroup ??= nextGroup();
      entry.alternativeGroup = prev.alternativeGroup;
    }
    entries.push(entry);
  }
  return entries;
}

type GridCell = { col: number; span: number; el: Element };

function rowCells($: cheerio.CheerioAPI, tr: Element): GridCell[] {
  let col = 0;
  return $(tr)
    .children("td,th")
    .toArray()
    .map((el) => {
      const span = Number($(el).attr("colspan") ?? 1) || 1;
      const cell = { col, span, el };
      col += span;
      return cell;
    });
}

/** Extract requirement credits ("Überfachliche Grundlagen … 6 Credits") from the footnotes. */
export function parseRequirements(footnotes: string[], placeholderNames: string[]): StudyPlanRequirement[] {
  const text = footnotes.join(" ");
  const reqs: StudyPlanRequirement[] = [];
  const push = (area: string, credits: number) => {
    if (!reqs.some((r) => r.area === area)) reqs.push({ area, credits });
  };

  const ufg = /Überfachliche Grundlagen[^.]*?(\d+)\s*Credits/i.exec(text);
  if (ufg) push("Überfachliche Grundlagen", Number(ufg[1]));
  const af = /Anwendungsfach[^.]*?(\d+)\s*Credits/i.exec(text);
  if (af) push("Anwendungsfach", Number(af[1]));
  for (const m of text.matchAll(/(\d+)\s*Credits\s+im\s+Bereich\s+(Wahlmodule\s+[\wäöüÄÖÜß]+)/gi)) {
    push(clean(m[2]), Number(m[1]));
  }
  // "… mindestens 18 Credits in dem Bereich" refers to the only elective placeholder of the plan.
  const generic = /mindestens\s+(\d+)\s*Credits\s+in\s+dem\s+Bereich/i.exec(text);
  const electives = [...new Set(placeholderNames.filter((n) => /^Wahlmodul/i.test(n)))];
  if (generic && electives.length === 1) push(electives[0], Number(generic[1]));
  return reqs;
}

function parseTitle(title: string): { startFrom: Semester | null; startUntil: Semester | null } {
  const range = /(?:von|ab)\s+(.+?)\s+bis\s+(.+)$/i.exec(title);
  if (range) return { startFrom: parseSemester(range[1]), startUntil: parseSemester(range[2]) };
  const from = /ab\s+(.+)$/i.exec(title);
  return { startFrom: from ? parseSemester(from[1]) : null, startUntil: null };
}

function parseSection($: cheerio.CheerioAPI, section: cheerio.Cheerio<AnyNode>, warnings: string[]): StudyPlan | null {
  const title = clean(section.find(".accordion-header, h2").first().text());
  const table = section.find("table").first();
  if (!title || !table.length) return null;

  const link = section.find('a[href*="StpStpNr="]').attr("href") ?? "";
  const stp = /pStpStpNr=(\d+)/i.exec(link);

  const rows = table.find("tr").toArray();
  // Area headers: the first row whose cells are all non-numeric labels besides Semester/Credits.
  const areaByCol = new Map<number, string>();
  for (const tr of rows) {
    const cells = rowCells($, tr);
    const texts = cells.map((c) => clean($(c.el).text()));
    if (/^\d+$/.test(texts[0] ?? "")) break; // reached the first semester row
    const labels = cells.filter((c, i) => texts[i] && !/^(Semester|Credits|Module)$/i.test(texts[i]));
    if (labels.length >= 2) {
      areaByCol.clear();
      for (const c of labels) {
        const label = clean($(c.el).text()).replace(/^Module\s+/i, "");
        for (let k = 0; k < c.span; k++) areaByCol.set(c.col + k, label);
      }
    }
  }

  let group = 0;
  const nextGroup = () => ++group;
  const semesters: StudyPlan["semesters"] = [];
  for (const tr of rows) {
    const cells = rowCells($, tr);
    const number = Number(clean($(cells[0]?.el).text()));
    if (!Number.isInteger(number) || number < 1 || number > 12) continue;
    const creditsText = clean($(cells[1]?.el).text());
    const credits = /(\d+)/.exec(creditsText);
    const entries: StudyPlanEntry[] = [];
    for (const cell of cells.slice(2)) {
      // Keep line structure: <br>/<p> separate items within one cell.
      const html = $(cell.el).html() ?? "";
      const text = cheerio.load(html.replace(/<br\s*\/?>/gi, " ").replace(/<\/p>/gi, " </p>")).text();
      entries.push(...parseCell(text, areaByCol.get(cell.col) ?? null, nextGroup));
    }
    semesters.push({ number, credits: credits ? Number(credits[1]) : null, entries });
  }
  if (semesters.length === 0) {
    warnings.push(`"${title}": no semester rows recognised`);
    return null;
  }

  const figure = table.closest("figure");
  const footnotes = (figure.length ? figure : table)
    .nextAll("p")
    .toArray()
    .map((p) => clean($(p).text()))
    .filter((t) => /^\*/.test(t));
  const placeholders = semesters.flatMap((s) => s.entries.filter((e) => e.kind === "placeholder").map((e) => e.title));

  return {
    title,
    ...parseTitle(title),
    tumonlineCurriculumId: stp ? Number(stp[1]) : null,
    semesters,
    footnotes,
    requirements: parseRequirements(footnotes, placeholders),
  };
}

export function parseCitStudyPlanPage(html: string): StudyPlanParseResult {
  const $ = cheerio.load(html);
  const warnings: string[] = [];
  const plans: StudyPlan[] = [];
  $(".c-accordion__item").each((_, el) => {
    try {
      const plan = parseSection($, $(el), warnings);
      if (plan) plans.push(plan);
    } catch (err) {
      warnings.push(`section skipped: ${String(err)}`);
    }
  });
  return { plans, warnings };
}
