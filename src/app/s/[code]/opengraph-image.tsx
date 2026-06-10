import { ImageResponse } from "next/og";
import { getGroupStandings } from "@/lib/groups";
import { BORINGBOT_ID, type StandingsRow } from "@/lib/standings";

// Edge runtime: next/og's renderer ships for edge here (the Node serverless
// bundle 500s on this deployment). The font is bundled alongside this file and
// loaded via import.meta.url — no runtime network fetch — so text always draws
// (the earlier blank image was a missing font on edge).
export const runtime = "edge";

export const alt = "World Cup 2026 leaderboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Load the bundled font, never throwing — a font failure must degrade to a
// (text-less) 200, not a 500.
async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    return await fetch(new URL("./noto-sans.ttf", import.meta.url)).then((r) =>
      r.arrayBuffer(),
    );
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

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const [data, font] = await Promise.all([
    getGroupStandings(code).catch(() => null),
    loadFont(),
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
      ...(font
        ? { fonts: [{ name: "Noto Sans", data: font, weight: 400 as const, style: "normal" as const }] }
        : {}),
    },
  );
}
