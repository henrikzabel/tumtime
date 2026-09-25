export function formatAverage(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : n.toFixed(2);
}

export function formatPercent(n: number | null | undefined, digits = 1): string {
  return n === null || n === undefined ? "—" : `${(n * 100).toFixed(digits)}%`;
}

export function formatCount(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : n.toLocaleString("en-US");
}

export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
