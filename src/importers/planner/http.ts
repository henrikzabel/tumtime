/**
 * Polite HTTP client for public TUM sources: identifies itself, waits between requests and
 * retries transient failures once. Never sends credentials.
 */
const USER_AGENT = "TUMTime/0.1 (unofficial student project; https://github.com/henrikzabel/tumtime)";

export type PoliteFetchOptions = { delayMs?: number; timeoutMs?: number };

let lastRequest = 0;

async function pause(delayMs: number) {
  const wait = lastRequest + delayMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
}

export async function politeFetch(url: string, { delayMs = 400, timeoutMs = 30_000 }: PoliteFetchOptions = {}) {
  for (let attempt = 0; ; attempt++) {
    await pause(delayMs);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json, text/html;q=0.9" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status >= 500 && attempt === 0) continue;
      return res;
    } catch (err) {
      if (attempt === 0) continue;
      throw err;
    }
  }
}

export async function fetchJson<T = unknown>(url: string, options?: PoliteFetchOptions): Promise<T | null> {
  const res = await politeFetch(url, options);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchText(url: string, options?: PoliteFetchOptions): Promise<string> {
  const res = await politeFetch(url, options);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}
