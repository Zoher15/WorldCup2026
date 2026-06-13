/**
 * Minimal transactional email via Resend's HTTP API — sent with `fetch`, so no
 * SDK dependency. Configured through two env vars:
 *   RESEND_API_KEY  server-only API key (emails are disabled when unset)
 *   EMAIL_FROM      the From header, e.g. "World Cup 2026 <noreply@your.domain>"
 *
 * Resend's default limit is 2 requests/second. Single sends (e.g. login magic
 * links) retry on 429/5xx honoring Retry-After; bulk reminders go through
 * sendEmailBatch, which packs up to 100 messages into ONE request (counted as a
 * single call against the rate limit), so a whole group doesn't burst past the
 * limit and silently drop mail.
 */

const SINGLE_ENDPOINT = "https://api.resend.com/emails";
const BATCH_ENDPOINT = "https://api.resend.com/emails/batch";
const BATCH_MAX = 100; // Resend's per-request cap for the batch endpoint
const MAX_ATTEMPTS = 5;

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? "World Cup 2026 <noreply@worldcup.kachwalas.com>";
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * POST to Resend with a few retries. 429 (rate limit) and 5xx are retried,
 * honoring the Retry-After header when present (else exponential backoff);
 * anything else throws.
 */
async function postToResend(url: string, payload: unknown, apiKey: string): Promise<void> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return;

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS - 1) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 2 ** attempt * 500;
      await sleep(waitMs);
      continue;
    }
    throw new Error(`Email send failed (${res.status}): ${await res.text()}`);
  }
}

export async function sendEmail(input: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set.");
  await postToResend(
    SINGLE_ENDPOINT,
    {
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      headers: input.headers,
    },
    apiKey,
  );
}

/**
 * Bulk send via Resend's batch endpoint. Up to 100 messages ride in a single
 * request — and a batch counts as ONE call against the 2 req/s limit — so a
 * whole group goes out in a request or two instead of a burst of N that trips
 * the limit. Per-message List-Unsubscribe headers are preserved; the in-body
 * unsubscribe link is the guaranteed fallback. Returns the number of messages
 * accepted; a failed sub-batch is skipped (not thrown) so one bad batch can't
 * sink the rest.
 */
export async function sendEmailBatch(messages: EmailMessage[]): Promise<number> {
  if (messages.length === 0) return 0;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set.");
  const from = fromAddress();

  let sent = 0;
  for (let i = 0; i < messages.length; i += BATCH_MAX) {
    const slice = messages.slice(i, i + BATCH_MAX).map((m) => ({
      from,
      to: m.to,
      subject: m.subject,
      html: m.html,
      headers: m.headers,
    }));
    try {
      await postToResend(BATCH_ENDPOINT, slice, apiKey);
      sent += slice.length;
    } catch {
      // Skip a failed sub-batch; the remaining batches still go out.
    }
  }
  return sent;
}
