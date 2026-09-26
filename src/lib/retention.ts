import { and, lt, ne, or } from "drizzle-orm";

import type { Db } from "@/db";
import { applications, clubClaims, loginTokens, sessions } from "@/db/schema";

export const APPLICATION_RETENTION_MONTHS = 6;

export function retentionCutoff(now = new Date(), months = APPLICATION_RETENTION_MONTHS): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

/** Delete personal data that is no longer needed. Safe to run repeatedly (e.g. daily). */
export async function purgeExpiredData(db: Db, now = new Date()) {
  const cutoff = retentionCutoff(now);
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
  const [apps, claims, tokens, expiredSessions] = await Promise.all([
    db.delete(applications).where(lt(applications.createdAt, cutoff)).returning({ id: applications.id }),
    db
      .delete(clubClaims)
      .where(and(ne(clubClaims.status, "pending"), lt(clubClaims.createdAt, cutoff)))
      .returning({ id: clubClaims.id }),
    db
      .delete(loginTokens)
      .where(or(lt(loginTokens.expiresAt, dayAgo), lt(loginTokens.createdAt, dayAgo)))
      .returning({ h: loginTokens.tokenHash }),
    db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({ h: sessions.idHash }),
  ]);
  return { applications: apps.length, claims: claims.length, loginTokens: tokens.length, sessions: expiredSessions.length };
}
