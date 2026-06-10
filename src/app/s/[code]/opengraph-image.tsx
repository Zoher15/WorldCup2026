import { ImageResponse } from "next/og";
import { getGroupStandings } from "@/lib/groups";
import { BORINGBOT_ID, type StandingsRow } from "@/lib/standings";
import { NOTO_SANS_BASE64 } from "./noto-sans-font";

// Edge runtime: next/og's renderer ships for edge here (the Node serverless
// bundle 500s on this deployment).
export const runtime = "edge";

export const alt = "World Cup 2026 leaderboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Override next/og's default `immutable, max-age=31536000`. That one-year cache
// pinned a stale/blank render on the CDN across deploys (the key is identical
// every deploy, so a redeploy never purges it). Instead: browsers revalidate
// every time, the edge caches for a few minutes (standings move), and serves
// stale while refreshing. The per-deploy `?v=` on the metadata image URL
// (page.tsx) gives each deploy a fresh key so a bad cache can't survive one.
const CACHE_HEADERS = {
  "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
};

// Decode the inlined font once. We do NOT fetch the .ttf as a bundled asset:
// on edge that asset mis-traces and the fetch returns non-font bytes (200,
// >2KB), which Satori parses past the end of -> "Offset is outside the bounds
// of the DataView" and the whole render throws. The bytes live in the JS bundle
// instead (noto-sans-font.ts), and we still verify the sfnt signature so only a
// real font is ever handed to Satori; on any doubt we return null and next/og
// falls back to its built-in font rather than crashing.
function loadFont(): ArrayBuffer | null {
  try {
    const bin = atob(NOTO_SANS_BASE64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.byteLength < 2000) return null;
    // Valid TrueType/OpenType sfnt signatures.
    const magic =
      (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    const SFNT = [0x00010000, 0x4f54544f, 0x74727565]; // TTF, 'OTTO', 'true'
    return SFNT.includes(magic >>> 0) ? bytes.buffer : null;
  } catch {
    return null;
  }
}

// Render slots place #1 in the middle, #2 left, #3 right.
const PODIUM_ORDER = [1, 0, 2];
const PODIUM_HEIGHT = [250, 200, 176]; // indexed by rank (0 = 1st)
const PODIUM_GRADIENT = [
  "linear-gradient(180deg, #ffd23f 0%, #ff5a36 100%)",
  "linear-gradient(180deg, #e7e5e4 0%, #a8a29e 100%)",
  "linear-gradient(180deg, #fdba74 0%, #f97316 100%)",
];
const PODIUM_INK = ["#b45309", "#78716c", "#c2410c"];
const PLACE = ["1st", "2nd", "3rd"];

// Note: no `text-overflow: ellipsis`. Satori splits an ellipsized string into
// multiple internal nodes, which trips its "a <div> with >1 child needs
// display:flex" rule. We clip instead (names here are short), and every div
// that uses this also sets display:flex.
const clip = {
  display: "flex",
  overflow: "hidden",
  whiteSpace: "nowrap",
} as const;

function PodiumColumn({ row, idx }: { row: StandingsRow | undefined; idx: number }) {
  if (!row) return <div style={{ display: "flex", width: 240 }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 240 }}>
      <div style={{ fontSize: 30, fontWeight: 700, color: PODIUM_INK[idx] }}>{PLACE[idx]}</div>
      <div style={{ fontSize: 34, fontWeight: 700, color: "#292524", maxWidth: 224, marginTop: 4, marginBottom: 10, ...clip }}>
        {row.displayName}
      </div>
      <div
        style={{
          display: "flex",
          width: 200,
          height: PODIUM_HEIGHT[idx],
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          background: PODIUM_GRADIENT[idx],
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 14,
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.6)",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, color: "#1c1917" }}>{row.points}</div>
      </div>
    </div>
  );
}

// A dead-simple, font-free, fetch-free frame. Used if anything in the main
// render throws, so the route always returns a valid PNG (a blank/broken card
// is what we're trying to escape) instead of a 500.
function fallbackImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #fff8ec 0%, #ffeede 45%, #ffe7f0 100%)",
        }}
      >
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#6b2fb3" }}>
          World Cup 2026 · Leaderboard
        </div>
      </div>
    ),
    { ...size, headers: CACHE_HEADERS },
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  try {
    return await renderPodium(await params);
  } catch {
    return fallbackImage();
  }
}

async function renderPodium(params: { code: string }) {
  const { code } = params;
  const [data, font] = await Promise.all([
    getGroupStandings(code).catch(() => null),
    Promise.resolve(loadFont()),
  ]);

  const rows = data?.standings.overall ?? [];
  const top3 = rows.slice(0, 3);
  // A compact "also-rans" line under the podium (skip the bot to keep it human).
  const rest = rows
    .slice(3)
    .filter((r) => r.userId !== BORINGBOT_ID)
    .slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: "flex",
          flexDirection: "column",
          padding: 56,
          fontFamily: "Noto Sans",
          background: "linear-gradient(160deg, #fff8ec 0%, #ffeede 45%, #ffe7f0 100%)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 56, fontWeight: 700, color: "#6b2fb3", maxWidth: 1040, ...clip }}>
            {data?.group.name ?? "World Cup 2026"}
          </div>
          <div style={{ fontSize: 26, fontWeight: 400, color: "#78716c", marginTop: 4 }}>
            World Cup 2026 · Leaderboard
          </div>
        </div>

        {/* Podium */}
        <div style={{ display: "flex", flex: 1, alignItems: "flex-end", justifyContent: "center", gap: 36, marginTop: 24 }}>
          {PODIUM_ORDER.map((idx, slot) => (
            <PodiumColumn key={slot} row={top3[idx]} idx={idx} />
          ))}
        </div>

        {/* Compact also-rans + footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 400, color: "#78716c", maxWidth: 760, ...clip }}>
            {rest.map((r, i) => `${i + 4}. ${r.displayName} · ${r.points}`).join("     ")}
          </div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 400, color: "#a8a29e" }}>
            worldcup.kachwalas.com
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: CACHE_HEADERS,
      ...(font
        ? { fonts: [{ name: "Noto Sans", data: font, weight: 400 as const, style: "normal" as const }] }
        : {}),
    },
  );
}
