/**
 * Comparison state lives in the URL so views can be shared:
 *   /compare?m=IN0001,IN0015:2023WS-endterm,MA0901:all
 * Each item is a module number with an optional exam selector:
 *   (none)             latest endterm (or latest exam)
 *   2023WS-endterm     one specific exam
 *   all                all exams of the module combined
 */
export const MAX_COMPARE = 4;

export type CompareItem = { code: string; selector: string | null };

export function parseCompareParam(param: string | undefined): CompareItem[] {
  if (!param) return [];
  const items: CompareItem[] = [];
  for (const raw of param.split(",")) {
    const [code, selector] = raw.trim().split(":");
    if (!code || !/^[A-Za-z]{2,5}\d[A-Za-z0-9_-]*$/.test(code)) continue;
    const sel = selector && /^(all|\d{4}(WS|SS)-(endterm|retake))$/.test(selector) ? selector : null;
    items.push({ code: code.toUpperCase(), selector: sel });
    if (items.length === MAX_COMPARE) break;
  }
  return items;
}

export function serializeCompare(items: CompareItem[]): string {
  return items.map((i) => (i.selector ? `${i.code}:${i.selector}` : i.code)).join(",");
}
