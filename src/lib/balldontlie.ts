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
const SPEC_URL = "https://www.balldontlie.io/openapi/fifa.yml";

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

export async function balldontlieDiagnostics(): Promise<unknown> {
  const out: Record<string, unknown> = {};

  // 1. Does the key work at all? (NBA is the original, always-available sport.)
  try {
    out.nbaSanity = await probe(
      "https://api.balldontlie.io/nba/v1/teams?per_page=1",
      true,
    );
  } catch (e) {
    out.nbaSanity = { error: e instanceof Error ? e.message : "failed" };
  }

  // 2. Discover the FIFA routes from the OpenAPI spec (no key needed).
  try {
    const res = await fetch(SPEC_URL, {
      headers: { "User-Agent": UA },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      out.spec = { status: res.status, body: text.slice(0, 300) };
    } else {
      const servers = [...text.matchAll(/url:\s*["']?([^\s"']+)/g)].map((m) => m[1]);
      const paths = [...text.matchAll(/^ {2}(\/[^\s:]*):/gm)].map((m) => m[1]);
      out.spec = { status: res.status, servers, paths };
    }
  } catch (e) {
    out.spec = { error: e instanceof Error ? e.message : "spec fetch failed" };
  }

  return out;
}
