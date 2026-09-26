import "server-only";

/**
 * Transactional e-mail via Resend (https://resend.com). Without RESEND_API_KEY (local development)
 * messages are printed to the server console instead of being sent.
 */
export type Email = { to: string | string[]; subject: string; text: string; replyTo?: string };

export async function sendEmail(email: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "TUM Time <noreply@tumtime.local>";
  if (!key) {
    console.info(`\n[email:dev] To: ${[email.to].flat().join(", ")}\nSubject: ${email.subject}\n\n${email.text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email.to].flat(),
      subject: email.subject,
      text: email.text,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
}

/** Absolute base URL for links in e-mails. */
export function appUrl(): string {
  return (process.env.APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/$/, "");
}
