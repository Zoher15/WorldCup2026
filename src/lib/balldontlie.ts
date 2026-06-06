/**
 * Diagnostics probe for the BALLDONTLIE FIFA API. We can't reach their docs
 * (bot-blocked), so this tries the likely endpoint shapes with a real key and
 * reports what comes back — letting us confirm whether the free tier returns
 * 2026 World Cup match data before we build the full client around it.
 *
 * BALLDONTLIE auth: the API key goes in the `Authorization` header (no Bearer).
 */
function bdlKey(): string {
  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key) throw new Error("BALLDONTLIE_API_KEY is not configured.");
  return key;
}

const CANDIDATE_URLS = [
  "https://api.balldontlie.io/fifa/v1/teams?per_page=1",
  "https://api.balldontlie.io/fifa/v1/games?seasons[]=2026&per_page=2",
  "https://api.balldontlie.io/fifa/v1/games?season=2026&per_page=2",
  "https://fifa.balldontlie.io/v1/games?seasons[]=2026&per_page=2",
  "https://api.balldontlie.io/fifa/v1/standings?season=2026",
];

export async function balldontlieDiagnostics(): Promise<unknown> {
  const key = bdlKey();
  const out: unknown[] = [];
  for (const url of CANDIDATE_URLS) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: key },
        cache: "no-store",
      });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* keep raw */
      }
      const data =
        parsed && typeof parsed === "object" && "data" in parsed
          ? (parsed as { data?: unknown[] }).data
          : null;
      out.push({
        url,
        httpStatus: res.status,
        dataLength: Array.isArray(data) ? data.length : null,
        sample: Array.isArray(data) && data.length > 0 ? data[0] : null,
        // surface error/message bodies (e.g. plan restrictions) when not ok
        body: res.ok ? undefined : text.slice(0, 400),
      });
    } catch (e) {
      out.push({ url, error: e instanceof Error ? e.message : "fetch failed" });
    }
  }
  return out;
}
