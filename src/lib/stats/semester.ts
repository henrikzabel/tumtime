/** Canonical semester format: "2024WS" (winter 2024/25) or "2025SS" (summer 2025). */
export type Semester = `${number}${"WS" | "SS"}`;

const CANONICAL = /^(\d{4})(WS|SS)$/;

/**
 * Parse the semester notations we encounter:
 *   "2024WS", "2025SS"           – canonical (TUM Info)
 *   "24W", "25S"                  – TUMonline exam titles
 *   "2024W"                       – occasional TUM Info variant
 *   "WS 2024/25", "SS 2025", "WiSe 2024/25", "SoSe 2025", "Winter semester 2024/25", "Summer semester 2025"
 */
export function parseSemester(input: string): Semester | null {
  const s = input.trim();
  const canonical = CANONICAL.exec(s.toUpperCase());
  if (canonical) return `${Number(canonical[1])}${canonical[2] as "WS" | "SS"}`;

  const short = /^(\d{2}|\d{4})\s*([WS])$/i.exec(s);
  if (short) {
    const year = short[1].length === 2 ? 2000 + Number(short[1]) : Number(short[1]);
    return `${year}${short[2].toUpperCase() === "W" ? "WS" : "SS"}`;
  }

  const long = /^(WS|SS|WiSe|SoSe|Winter\s*semester|Summer\s*semester|Wintersemester|Sommersemester)\s*(\d{2,4})(?:\s*\/\s*\d{2,4})?$/i.exec(
    s,
  );
  if (long) {
    const winter = /^(ws|wise|winter)/i.test(long[1]);
    const year = long[2].length === 2 ? 2000 + Number(long[2]) : Number(long[2]);
    return `${year}${winter ? "WS" : "SS"}`;
  }
  return null;
}

/** Sortable integer: summer 2024 < winter 2024/25 < summer 2025. */
export function semesterKey(semester: Semester): number {
  const m = CANONICAL.exec(semester)!;
  return Number(m[1]) * 2 + (m[2] === "WS" ? 1 : 0);
}

export function formatSemester(semester: Semester): string {
  const m = CANONICAL.exec(semester)!;
  const year = Number(m[1]);
  return m[2] === "WS" ? `Winter ${year}/${String(year + 1).slice(-2)}` : `Summer ${year}`;
}
