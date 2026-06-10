import { ImageResponse } from "next/og";
import { type StandingsRow } from "./standings";
import { NOTO_SANS_BASE64 } from "./noto-sans-font";

// Renders the leaderboard share image (1200x630) on the Node runtime — during
// the poll / on group creation / lazily on first view, never on a crawler's
// request to the cached endpoint — so the share endpoint only serves stored
// bytes and can't blank. The font is inlined (noto-sans-font.ts) so the renderer
// always gets valid bytes; on any doubt we omit it and next/og falls back to its
// built-in font rather than crashing.
//
// This mirrors the on-page dark "glass" leaderboard. Note: Satori has no
// backdrop-filter, so glass is approximated with translucent fills + hairline
// borders + top highlights over a dark violet glow (not literal blur).
export const OG_SIZE = { width: 1200, height: 630 };

// Bump when the layout changes. The /s/<code>/og endpoint compares this to each
// stored image's render_version (migration 0006) and re-renders anything older,
// so a design change reaches already-cached groups on their next view.
export const OG_RENDER_VERSION = 2;

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

// Satori: a <div> with more than one child must declare display:flex, and an
// ellipsized string splits into multiple nodes (so we clip instead). Every div
// below that holds text also sets display:flex via this.
const clip = {
  display: "flex",
  overflow: "hidden",
  whiteSpace: "nowrap",
} as const;

const GLASS = "rgba(255,255,255,0.06)";
const GLASS_BORDER = "1px solid rgba(255,255,255,0.12)";
const INK = "#f5f5f4"; // names / primary text
const MUTED = "#a8a29e"; // ranks / secondary

// Podium (top three). Render order places #2 left, #1 center, #3 right.
const PODIUM_ORDER = [1, 0, 2];
const PODIUM_HEIGHT = [116, 88, 74]; // indexed by rank (0 = 1st)
const PODIUM_GRADIENT = [
  "linear-gradient(180deg, #d4a017 0%, #8a3d1a 100%)",
  "linear-gradient(180deg, #d1d5db 0%, #6b7280 100%)",
  "linear-gradient(180deg, #c98a3a 0%, #7c4a1e 100%)",
];
const MEDAL_COLOR = ["#f59e0b", "#cbd5e1", "#d97706"];
const RANK_INK = ["#fbbf24", "#cbd5e1", "#d6914a"];
const MAX_LIST = 6; // ranks 4..9 below the podium (two columns of three); "+N more" beyond

// A numbered medal with a little blue ribbon, like the on-page podium.
function Medal({ idx }: { idx: number }) {
  return (
    <div style={{ display: "flex", position: "relative", width: 60, height: 60, alignItems: "flex-start", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: 0, left: 16, width: 12, height: 30, background: "linear-gradient(180deg,#3b82f6,#1d4ed8)", borderRadius: 3, transform: "rotate(18deg)" }} />
      <div style={{ position: "absolute", top: 0, right: 16, width: 12, height: 30, background: "linear-gradient(180deg,#3b82f6,#1d4ed8)", borderRadius: 3, transform: "rotate(-18deg)" }} />
      <div
        style={{
          position: "absolute",
          top: 16,
          display: "flex",
          width: 42,
          height: 42,
          borderRadius: 21,
          background: MEDAL_COLOR[idx],
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid rgba(255,255,255,0.55)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", fontSize: 21, fontWeight: 700, color: "#1c1917" }}>{idx + 1}</div>
      </div>
    </div>
  );
}

function PodiumColumn({ row, idx }: { row: StandingsRow | undefined; idx: number }) {
  if (!row) return <div style={{ display: "flex", width: 210 }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 210 }}>
      <Medal idx={idx} />
      <div style={{ fontSize: 27, fontWeight: 700, color: INK, maxWidth: 200, marginTop: 0, marginBottom: 6, ...clip }}>
        {row.displayName}
      </div>
      <div
        style={{
          display: "flex",
          width: 174,
          height: PODIUM_HEIGHT[idx],
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          background: PODIUM_GRADIENT[idx],
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 10,
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.35)",
        }}
      >
        <div style={{ display: "flex", fontSize: 42, fontWeight: 700, color: "#fafaf9" }}>{row.points}</div>
      </div>
    </div>
  );
}

// Layout widths. Columns get an explicit pixel width (not flex:1): on Vercel's
// Satori a percentage/flex-grow child inside a flex-sized parent doesn't resolve,
// which collapsed the name cell to zero. Fixed widths — like the podium, which
// always rendered correctly — and space-between for the points avoid that.
const CARD_CONTENT_W = OG_SIZE.width - 2 * 28 - 2 * 34; // 1076
const COL_GAP = 22;
const ONE_COL_W = CARD_CONTENT_W;
const TWO_COL_W = Math.floor((CARD_CONTENT_W - COL_GAP) / 2);

function ListRow({ row, rank, colW }: { row: StandingsRow; rank: number; colW: number }) {
  return (
    <div
      style={{
        display: "flex",
        width: colW,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 18px",
        borderRadius: 16,
        background: GLASS,
        border: GLASS_BORDER,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: colW - 110, overflow: "hidden" }}>
        <div style={{ display: "flex", width: 30, justifyContent: "center", fontSize: 25, fontWeight: 700, color: RANK_INK[rank - 1] ?? MUTED }}>
          {rank}
        </div>
        <div style={{ fontSize: 25, fontWeight: 700, color: INK, ...clip }}>{row.displayName}</div>
      </div>
      <div style={{ display: "flex", fontSize: 25, fontWeight: 700, color: "#fafaf9" }}>{row.points}</div>
    </div>
  );
}

function ListColumn({ rows, colW }: { rows: { row: StandingsRow; rank: number }[]; colW: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: colW, gap: 8 }}>
      {rows.map(({ row, rank }) => (
        <ListRow key={row.userId} row={row} rank={rank} colW={colW} />
      ))}
    </div>
  );
}

/**
 * Render a group's overall leaderboard to PNG bytes, mirroring the on-page dark
 * glass design: a medal podium for the top three, then ranked glass rows (name +
 * points) for everyone else, in two columns when there are many. A null name /
 * empty list still produces a valid branded frame (the generic default).
 */
export async function renderLeaderboardPng(
  groupName: string | null,
  overall: StandingsRow[],
): Promise<Uint8Array> {
  const top3 = overall.slice(0, 3);
  const restRows = overall
    .slice(3, 3 + MAX_LIST)
    .map((row, i) => ({ row, rank: i + 4 }));
  const overflow = Math.max(0, overall.length - 3 - restRows.length);
  const twoCol = restRows.length > 3;
  const per = twoCol ? Math.ceil(restRows.length / 2) : restRows.length;
  const col1 = restRows.slice(0, per);
  const col2 = restRows.slice(per);
  const font = loadFont();

  const res = new ImageResponse(
    (
      <div
        style={{
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          display: "flex",
          padding: 28,
          fontFamily: "Noto Sans",
          background:
            "radial-gradient(1100px 520px at 50% -12%, rgba(124,58,237,0.28), rgba(124,58,237,0) 60%), linear-gradient(160deg, #1c1917 0%, #0c0a09 100%)",
        }}
      >
        {/* Glass card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            padding: "18px 34px",
            borderRadius: 32,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ display: "flex", fontSize: 40 }}>🏆</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: "#c4b5fd", maxWidth: 940, ...clip }}>
              {groupName ?? "Leaderboard"}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", fontSize: 20, fontWeight: 400, color: MUTED, marginTop: 2 }}>
            World Cup 2026 · Leaderboard
          </div>

          {/* Podium */}
          {top3.length > 0 && (
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 26, marginTop: 8 }}>
              {PODIUM_ORDER.map((idx, slot) => (
                <PodiumColumn key={slot} row={top3[idx]} idx={idx} />
              ))}
            </div>
          )}

          {/* Ranked glass rows for everyone else */}
          <div style={{ display: "flex", flex: 1, gap: COL_GAP, marginTop: 10, alignItems: "flex-start", justifyContent: "center" }}>
            {restRows.length === 0 ? (
              <div style={{ display: "flex" }} />
            ) : (
              <>
                <ListColumn rows={col1} colW={twoCol ? TWO_COL_W : ONE_COL_W} />
                {col2.length > 0 && <ListColumn rows={col2} colW={TWO_COL_W} />}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 400, color: MUTED }}>
              {overflow > 0 ? `+${overflow} more` : `${overall.length} on the board`}
            </div>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 400, color: "#78716c" }}>
              worldcup.kachwalas.com
            </div>
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
