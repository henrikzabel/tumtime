import { createHash, randomBytes } from "node:crypto";

export const LOGIN_TOKEN_TTL_MINUTES = 15;
export const SESSION_TTL_DAYS = 30;
export const MAX_LINKS_PER_HOUR = 5;

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Only TUM addresses may sign in: the configured domains and their subdomains
 * (e.g. "tum.de" also allows "in.tum.de", "cit.tum.de").
 */
export function isAllowedEmail(email: string, domains: string[]): boolean {
  const m = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/.exec(normalizeEmail(email));
  if (!m) return false;
  const host = m[1];
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

export function allowedDomains(env = process.env.ALLOWED_EMAIL_DOMAINS): string[] {
  return (env ?? "tum.de,mytum.de")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/** Tolerates quotes and comma/semicolon/whitespace separators, as often pasted into hosting dashboards. */
export function adminEmails(env = process.env.ADMIN_EMAILS): Set<string> {
  return new Set(
    (env ?? "")
      .split(/[\s,;]+/)
      .map((e) => normalizeEmail(e.replace(/^["']+|["']+$/g, "")))
      .filter(Boolean),
  );
}

/** Only allow same-site relative redirects after login. */
export function safeRedirect(target: string | null | undefined, fallback = "/me"): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}
