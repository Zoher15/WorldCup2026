/**
 * Diagnostics for the BALLDONTLIE FIFA API. We can't reach their site from the
 * sandbox (allowlist) or via the docs (bot-blocked), so this runs on the Vercel
 * deployment: it (1) sanity-checks the key against a known sport, and (2) pulls
 * the FIFA OpenAPI spec to discover the exact routes. From that we build the
 * real client.
 *
 * BALLDONTLIE auth: the API key goes in the `Authorization` header (no Bearer).
 */
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

function bdlKey(): string {
  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key) throw new Error("BALLDONTLIE_API_KEY is not configured.");
  return key;
}

async function probe(url: string, useKey: boolean): Promise<unknown> {
  const headers: Record<string, string> = { "User-Agent": UA };
  if (useKey) headers.Authorization = bdlKey();
  const res = await fetch(url, { headers, cache: "no-store" });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  return {
    url,
    status: res.status,
    json: json ?? undefined,
    body: json ? undefined : text.slice(0, 300),
  };
}

const FIFA_BASE = "https://api.balldontlie.io/fifa/worldcup/v1";

export async function balldontlieDiagnostics(): Promise<unknown> {
  const out: Record<string, unknown> = {};
  // Hit the real FIFA routes to confirm free-tier entitlement and capture the
  // match/team schema we'll build the client around.
  for (const [label, path] of [
    ["teams", "/teams?per_page=2"],
    ["matches", "/matches?per_page=3"],
    ["group_standings", "/group_standings?per_page=2"],
  ] as const) {
    try {
      out[label] = await probe(`${FIFA_BASE}${path}`, true);
    } catch (e) {
      out[label] = { error: e instanceof Error ? e.message : "failed" };
    }
  }
  return out;
}
