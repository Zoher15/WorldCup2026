/**
 * Minimal transactional email via Resend's HTTP API — sent with `fetch`, so no
 * SDK dependency. Configured through two env vars:
 *   RESEND_API_KEY  server-only API key (emails are disabled when unset)
 *   EMAIL_FROM      the From header, e.g. "World Cup 2026 <noreply@your.domain>"
 */

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set.");
  const from =
    process.env.EMAIL_FROM ?? "World Cup 2026 <noreply@worldcup.kachwalas.com>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      headers: input.headers,
    }),
  });
  if (!res.ok) {
    throw new Error(`Email send failed (${res.status}): ${await res.text()}`);
  }
}
