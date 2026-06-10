import { ImageResponse } from "next/og";
import { type StandingsRow } from "./standings";
import { NOTO_SANS_BASE64 } from "./noto-sans-font";

// Renders the leaderboard share image (1200x630) on the Node runtime. This runs
// server-side during the poll / on group creation / lazily on first view —
// never on a crawler's request to the cached endpoint — so the share endpoint
// only ever serves stored bytes and can't blank. The font is inlined (see
// noto-sans-font.ts) so the renderer always gets valid bytes; on any doubt we
// omit it and next/og falls back to its built-in font rather than crashing.
export const OG_SIZE = { width: 1200, height: 630 };

function loadFont(): ArrayBuffer | null {
  try {
    const bin = atob(NOTO_SANS_BASE64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.byteLength < 2000) return null;
    const magic = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    const SFNT = [0x00010000, 0x4f54544f, 0x74727565]; // TTF, 'OTTO', 'true'
    return SFNT.includes(magic >>> 0) ? bytes.buffer : null;
  } catch {
    return null;
  }
}

// Gold / silver / bronze for the top three ranks; everyone else is neutral.
const RANK_INK = ["#d97706", "#78716c", "#c2410c"];
const MAX_ROWS = 16; // up to two columns of eight; rare to exceed in a pool

// Satori: a <div> with more than one child must declare display:flex, and an
// ellipsized string splits into multiple nodes (so we clip instead). Every div
// below that holds text also sets display:flex via this.
const clip = {
  display: "flex",
  overflow: "hidden",
  whiteSpace: "nowrap",
} as const;

function PlayerRow({ row, rank }: { row: StandingsRow; rank: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "6px 16px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.5)",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 44,
          justifyContent: "center",
          fontSize: 26,
          fontWeight: 700,
          color: RANK_INK[rank - 1] ?? "#a8a29e",
        }}
      >
        {rank}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#292524", flex: 1, ...clip }}>
        {row.displayName}
      </div>
      <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#1c1917" }}>
        {row.points}
      </div>
    </div>
  );
}

function Column({ rows, startRank }: { rows: StandingsRow[]; startRank: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 6 }}>
      {rows.map((r, i) => (
        <PlayerRow key={r.userId} row={r} rank={startRank + i} />
      ))}
    </div>
  );
}

/**
 * Render a group's full overall leaderboard (every player, name + points, in up
 * to two columns) to PNG bytes. A null name / empty list still produces a valid
 * branded frame (the generic default).
 */
export async function renderLeaderboardPng(
  groupName: string | null,
  overall: StandingsRow[],
): Promise<Uint8Array> {
  const shown = overall.slice(0, MAX_ROWS);
  const twoCol = shown.length > 8;
  const per = twoCol ? Math.ceil(shown.length / 2) : shown.length;
  const col1 = shown.slice(0, per);
  const col2 = shown.slice(per);
  const overflow = overall.length - shown.length;
  const font = loadFont();

  const res = new ImageResponse(
    (
      <div
        style={{
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          display: "flex",
          flexDirection: "column",
          padding: 48,
          fontFamily: "Noto Sans",
          background: "linear-gradient(160deg, #fff8ec 0%, #ffeede 45%, #ffe7f0 100%)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 46, fontWeight: 700, color: "#6b2fb3", maxWidth: 1080, ...clip }}>
            {groupName ?? "World Cup 2026"}
          </div>
          <div style={{ fontSize: 22, fontWeight: 400, color: "#78716c", marginTop: 2 }}>
            World Cup 2026 · Leaderboard
          </div>
        </div>

        {/* Ranked players */}
        <div style={{ display: "flex", flex: 1, gap: 32, marginTop: 18, alignItems: "flex-start" }}>
          {shown.length === 0 ? (
            <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", fontSize: 28, color: "#a8a29e" }}>
              No players yet
            </div>
          ) : (
            <>
              <Column rows={col1} startRank={1} />
              {col2.length > 0 && <Column rows={col2} startRank={per + 1} />}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 400, color: "#78716c" }}>
            {overflow > 0 ? `+${overflow} more` : `${overall.length} on the board`}
          </div>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 400, color: "#a8a29e" }}>
            worldcup.kachwalas.com
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      ...(font
        ? { fonts: [{ name: "Noto Sans", data: font, weight: 400 as const, style: "normal" as const }] }
        : {}),
    },
  );
  return new Uint8Array(await res.arrayBuffer());
}
