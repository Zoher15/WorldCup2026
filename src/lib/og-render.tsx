import { createHash } from "node:crypto";
import { ImageResponse } from "next/og";
import { competitionRanks, type StandingsRow } from "./standings";
import { teamLabel } from "./fifa";
import { formatStageLabel } from "./format";
import { NOTO_SANS_BASE64 } from "./noto-sans-font";
import type { MatchBoard } from "./match-leaderboard";

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
// The image is a fixed 1200 wide; its height grows with the group so every name
// bubble keeps a uniform size (big groups extend the canvas downward instead of
// cramming) and small groups don't trail empty space (a 630 floor keeps the
// link-unfurl aspect sane). ogImageSize() is the single source of truth — both
// the renderer and the page's generateMetadata size from it.
export const OG_WIDTH = 1200;
const OG_MIN_HEIGHT = 630;

// Bump when the layout changes. The /s/<code>/og endpoint compares this to each
// stored image's render_version (migration 0006) and re-renders anything older,
// so a design change reaches already-cached groups on their next view.
export const OG_RENDER_VERSION = 7;

/**
 * A fingerprint of everything the image draws: the layout version, the group
 * name, and the ordered rows (rank, name, points, movement, streak). Stored
 * alongside the PNG so we re-render exactly when the leaderboard changes — a
 * join, a rename, a result, a streak extending or breaking — without having to
 * enumerate every such event by hand. Includes more rows than the card lists
 * (MAX_LIST) on purpose: a change beyond the visible cap still alters the
 * "+N more" footer, so it should invalidate.
 */
export function ogContentHash(groupName: string, overall: StandingsRow[]): string {
  const h = createHash("sha256");
  h.update(`v${OG_RENDER_VERSION}\n${groupName}\n`);
  for (const r of overall) {
    h.update(`${r.userId}\t${r.displayName}\t${r.points}\t${r.movement}\t${r.streak ?? 0}\n`);
  }
  return h.digest("hex").slice(0, 32);
}

// Below-podium rows shown (ranks 4..). Beyond this the footer reads "+N more".
// Two columns, so this is an even cap of how many names the card lists.
const MAX_LIST = 30;

// Section heights used to size the canvas to its content. Biased slightly high so
// the content always fits (the card is vertically centred, so any slack lands as
// balanced padding rather than a bottom gap or a clipped edge).
const CANVAS_PAD = 28; // outer frame padding (all sides)
const CARD_VPAD = 18; // glass card top+bottom padding
const HEADER_H = 54;
const SUB_H = 30;
const PODIUM_H = 226; // medal + name + tallest bar + its margin-top
const LIST_MARGIN_TOP = 10;
const ROW_H = 44; // one name bubble
const ROW_GAP = 8; // between bubbles in a column
const FOOTER_H = 30;
const HEIGHT_SLACK = 24;

/** How the below-podium rows split into columns, shared by the renderer and the
 *  height calc so both agree on row counts. */
function listLayout(total: number) {
  const listCount = Math.min(Math.max(total - 3, 0), MAX_LIST);
  const twoCol = listCount > 3;
  const rowsPerCol = twoCol ? Math.ceil(listCount / 2) : listCount;
  return { listCount, twoCol, rowsPerCol };
}

/** The PNG dimensions for a group of `total` members. Height grows with the
 *  number of listed rows and never dips below OG_MIN_HEIGHT. */
export function ogImageSize(total: number): { width: number; height: number } {
  const { rowsPerCol } = listLayout(total);
  const listH =
    rowsPerCol > 0
      ? LIST_MARGIN_TOP + rowsPerCol * ROW_H + (rowsPerCol - 1) * ROW_GAP
      : 0;
  const content =
    2 * CANVAS_PAD +
    2 * CARD_VPAD +
    HEADER_H +
    SUB_H +
    (total > 0 ? PODIUM_H : 0) +
    listH +
    FOOTER_H +
    HEIGHT_SLACK;
  return { width: OG_WIDTH, height: Math.max(OG_MIN_HEIGHT, content) };
}

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
const FLAME = "#ff5a36"; // scoring-streak flame (matches --color-flame)

// Emoji don't render in this Satori/Noto setup (no emoji font, no network to a
// CDN), so the streak flame is a self-contained inline SVG drawn as an <img> —
// the same reason the medals are hand-drawn rather than 🥇/🥈/🥉.
const FLAME_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
  `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">` +
  `<stop offset="0" stop-color="#ffd23f"/>` +
  `<stop offset="0.55" stop-color="#ff7a3c"/>` +
  `<stop offset="1" stop-color="#ff3b2f"/></linearGradient></defs>` +
  `<path fill="url(#f)" fill-rule="evenodd" clip-rule="evenodd" ` +
  `d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.177A7.547 7.547 0 0 1 5.648 6.61a.75.75 0 0 0-1.152.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1.005a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.713Z"/></svg>`;
const FLAME_ICON = `data:image/svg+xml;base64,${Buffer.from(FLAME_SVG).toString("base64")}`;

// Podium (top three). Render order places #2 left, #1 center, #3 right.
const PODIUM_ORDER = [1, 0, 2];
// Height, gradient, medal colour and rank ink are all indexed by rank (0 = 1st),
// never by podium slot — so tied places match the on-page board: two co-leaders
// both stand on equal-height gold steps, and the next takes bronze. Bronze is a
// deep copper (not orange) so it never reads as a second gold.
const PODIUM_HEIGHT = [116, 88, 74];
const PODIUM_GRADIENT = [
  "linear-gradient(180deg, #d4a017 0%, #8a3d1a 100%)", // gold
  "linear-gradient(180deg, #d1d5db 0%, #6b7280 100%)", // silver
  "linear-gradient(180deg, #b9722e 0%, #4f2c12 100%)", // bronze (deep copper)
];
const MEDAL_COLOR = ["#f59e0b", "#cbd5e1", "#b56a2b"]; // gold / silver / bronze
const RANK_INK = ["#fbbf24", "#cbd5e1", "#c07a3a"];

// A numbered medal with a little blue ribbon, like the on-page podium. The
// number is the competition rank, so tied players share it (two level at the
// top are both medal "1"); colour follows the rank too.
function Medal({ rank }: { rank: number }) {
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
          background: MEDAL_COLOR[rank - 1] ?? MEDAL_COLOR[2],
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid rgba(255,255,255,0.55)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", fontSize: 21, fontWeight: 700, color: "#1c1917" }}>{rank}</div>
      </div>
    </div>
  );
}

function PodiumColumn({
  entry,
}: {
  entry: { row: StandingsRow; rank: number; tied: boolean } | undefined;
}) {
  if (!entry) return <div style={{ display: "flex", width: 210 }} />;
  const { row, rank, tied } = entry;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 210 }}>
      {/* Medal, bar colour and bar height all follow the shared rank, so tied
          places match — two co-leaders both stand on equal-height gold steps. */}
      <Medal rank={rank} />
      <div style={{ fontSize: 27, fontWeight: 700, color: INK, maxWidth: 200, marginTop: 0, marginBottom: 6, ...clip }}>
        {row.displayName}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 174,
          height: PODIUM_HEIGHT[rank - 1] ?? PODIUM_HEIGHT[2],
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          background: PODIUM_GRADIENT[rank - 1] ?? PODIUM_GRADIENT[2],
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 5,
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.35)",
        }}
      >
        <div style={{ display: "flex", fontSize: 42, lineHeight: 1, fontWeight: 700, color: "#fafaf9" }}>
          {tied ? `=${row.points}` : row.points}
        </div>
        {/* A live scoring streak rides under the points, like the on-page bar —
            on a dark pill so the flame reads against the gold/silver/bronze
            gradient (the PNG has no frosted glass to sit it on). */}
        {(row.streak ?? 0) >= 2 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              marginTop: 3,
              paddingTop: 1,
              paddingBottom: 1,
              paddingLeft: 7,
              paddingRight: 8,
              borderRadius: 999,
              background: "rgba(20,18,16,0.66)",
              border: "1px solid rgba(255,255,255,0.18)",
              fontSize: 14,
              lineHeight: 1,
              fontWeight: 700,
              color: "#ffd9a8",
            }}
          >
            <img src={FLAME_ICON} width={13} height={15} alt="" />
            {row.streak}
          </div>
        )}
      </div>
    </div>
  );
}

// Layout widths. Columns get an explicit pixel width (not flex:1): on Vercel's
// Satori a percentage/flex-grow child inside a flex-sized parent doesn't resolve,
// which collapsed the name cell to zero. Fixed widths — like the podium, which
// always rendered correctly — and space-between for the points avoid that.
const CARD_CONTENT_W = OG_WIDTH - 2 * 28 - 2 * 34; // 1076
const COL_GAP = 22;
const ONE_COL_W = CARD_CONTENT_W;
const TWO_COL_W = Math.floor((CARD_CONTENT_W - COL_GAP) / 2);

type ListEntry = { row: StandingsRow; rank: number; tied: boolean };

function ListRow({ row, rank, tied, colW }: ListEntry & { colW: number }) {
  return (
    <div
      style={{
        display: "flex",
        width: colW,
        height: ROW_H,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 18px",
        borderRadius: 16,
        background: GLASS,
        border: GLASS_BORDER,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: colW - 160, overflow: "hidden" }}>
        {/* Tied players share a rank ("=4"), competition style — as on the page. */}
        <div style={{ display: "flex", width: 38, justifyContent: "center", fontSize: 25, fontWeight: 700, color: RANK_INK[rank - 1] ?? MUTED }}>
          {tied ? `=${rank}` : rank}
        </div>
        <div style={{ fontSize: 25, fontWeight: 700, color: INK, ...clip }}>{row.displayName}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Scoring-streak flame, mirroring the on-page leaderboard row. */}
        {(row.streak ?? 0) >= 2 && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 22, fontWeight: 700, color: FLAME }}>
            <img src={FLAME_ICON} width={17} height={20} alt="" />
            {row.streak}
          </div>
        )}
        <div style={{ display: "flex", fontSize: 25, fontWeight: 700, color: "#fafaf9" }}>{row.points}</div>
      </div>
    </div>
  );
}

function ListColumn({ rows, colW }: { rows: ListEntry[]; colW: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: colW, gap: ROW_GAP }}>
      {rows.map((entry) => (
        <ListRow key={entry.row.userId} {...entry} colW={colW} />
      ))}
    </div>
  );
}

/**
 * Render a group's overall leaderboard to PNG bytes, mirroring the on-page dark
 * glass design: a medal podium for the top three, then ranked glass rows (name +
 * points) for everyone else, in two columns when there are many — with shared
 * "=" ranks on ties and a 🔥 flame on anyone riding a scoring streak, just like
 * the page. A null name / empty list still produces a valid branded frame.
 */
export async function renderLeaderboardPng(
  groupName: string | null,
  overall: StandingsRow[],
): Promise<Uint8Array> {
  // Standard competition ranking (1, 1, 3) with a shared "=" mark on ties, so
  // the share image reads the same as the on-page leaderboard.
  const ranks = competitionRanks(overall);
  const tiedAt = (i: number) =>
    (i > 0 && overall[i - 1].points === overall[i].points) ||
    (i < overall.length - 1 && overall[i + 1].points === overall[i].points);
  const top3 = overall
    .slice(0, 3)
    .map((row, i) => ({ row, rank: ranks[i], tied: tiedAt(i) }));
  const { listCount, twoCol, rowsPerCol } = listLayout(overall.length);
  const restRows = overall
    .slice(3, 3 + listCount)
    .map((row, i) => ({ row, rank: ranks[i + 3], tied: tiedAt(i + 3) }));
  const overflow = Math.max(0, overall.length - 3 - restRows.length);
  const col1 = restRows.slice(0, rowsPerCol);
  const col2 = restRows.slice(rowsPerCol);
  const size = ogImageSize(overall.length);
  const font = loadFont();

  const res = new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
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
            justifyContent: "center",
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
                <PodiumColumn key={slot} entry={top3[idx]} />
              ))}
            </div>
          )}

          {/* Ranked glass rows for everyone else */}
          {restRows.length > 0 && (
            <div style={{ display: "flex", gap: COL_GAP, marginTop: LIST_MARGIN_TOP, alignItems: "flex-start", justifyContent: "center" }}>
              <ListColumn rows={col1} colW={twoCol ? TWO_COL_W : ONE_COL_W} />
              {col2.length > 0 && <ListColumn rows={col2} colW={TWO_COL_W} />}
            </div>
          )}

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
      ...size,
      ...(font
        ? { fonts: [{ name: "Noto Sans", data: font, weight: 400 as const, style: "normal" as const }] }
        : {}),
    },
  );
  return new Uint8Array(await res.arrayBuffer());
}

// ── Per-match share image ────────────────────────────────────────────────────
// The leaderboard image is pre-rendered and stored (it changes on every join /
// result, and crawlers must never trigger a render). A match board changes far
// less — picks are frozen at kickoff and the score only moves while it's live —
// so its /og endpoint renders on demand behind the same short CDN cache, with no
// stored-bytes table to migrate. Same dark "glass" look as the leaderboard.

// Section heights for sizing the match canvas to its content (biased high so it
// always fits; the card is centred, so any slack lands as balanced padding).
const MATCH_GROUP_H = 50; // group name header
const MATCH_SUB_H = 28; // "World Cup 2026 · <stage>"
const MATCH_BAR_H = 116; // teams + score tile
const MATCH_CAPTION_H = 28; // "<n> of <m> predicted"

const PICK_INK = "#c4b5fd"; // a player's predicted scoreline (violet, like the app)
const PITCH = "#34d399"; // "locked in" / full-time accent (emerald)

/** How a match board's rows split into columns, shared by the renderer and the
 *  height calc so both agree on row counts. */
function matchListLayout(total: number) {
  const listCount = Math.min(total, MAX_LIST);
  const twoCol = listCount > 8;
  const rowsPerCol = twoCol ? Math.ceil(listCount / 2) : listCount;
  return { listCount, twoCol, rowsPerCol };
}

/** The PNG dimensions for a match board of `total` rows. Height grows with the
 *  number of listed players and never dips below OG_MIN_HEIGHT. */
export function matchOgImageSize(total: number): { width: number; height: number } {
  const { rowsPerCol } = matchListLayout(total);
  const listH =
    rowsPerCol > 0
      ? LIST_MARGIN_TOP + rowsPerCol * ROW_H + (rowsPerCol - 1) * ROW_GAP
      : 0;
  const content =
    2 * CANVAS_PAD +
    2 * CARD_VPAD +
    MATCH_GROUP_H +
    MATCH_SUB_H +
    MATCH_BAR_H +
    MATCH_CAPTION_H +
    listH +
    FOOTER_H +
    HEIGHT_SLACK;
  return { width: OG_WIDTH, height: Math.max(OG_MIN_HEIGHT, content) };
}

// Match-bar widths: a fixed score tile in the centre with a team name on each
// side. Fixed pixel widths (not flex:1) for the same Satori reason as the
// leaderboard columns — a flex-grow child can collapse to zero on Vercel.
const MATCH_CENTER_W = 200;
const MATCH_SIDE_W = Math.floor((CARD_CONTENT_W - MATCH_CENTER_W - 2 * COL_GAP) / 2);

type MatchRow = MatchBoard["rows"][number];

/** The right-hand status for one player's row: their revealed call + points, or,
 *  before kickoff, just whether they've locked a pick in (picks stay hidden). */
function MatchRowStatus({ row, revealed }: { row: MatchRow; revealed: boolean }) {
  if (!revealed) {
    return (
      <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: row.hasPrediction ? PITCH : MUTED }}>
        {row.hasPrediction ? "Locked in" : "—"}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", fontSize: 23, fontWeight: 700, color: row.pick ? PICK_INK : MUTED }}>
        {row.pick ? `${row.pick.home}–${row.pick.away}` : "No pick"}
      </div>
      {row.points != null && (
        <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: INK }}>
          {row.points} pt{row.points === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

function MatchRowCard({ row, revealed, colW }: { row: MatchRow; revealed: boolean; colW: number }) {
  return (
    <div
      style={{
        display: "flex",
        width: colW,
        height: ROW_H,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 18px",
        borderRadius: 16,
        background: GLASS,
        border: row.isViewer ? "1px solid rgba(196,181,253,0.55)" : GLASS_BORDER,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 700, color: INK, maxWidth: colW - 220, ...clip }}>
        {row.displayName}
        {row.isViewer ? " (you)" : ""}
      </div>
      <MatchRowStatus row={row} revealed={revealed} />
    </div>
  );
}

function MatchColumn({ rows, revealed, colW }: { rows: MatchRow[]; revealed: boolean; colW: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: colW, gap: ROW_GAP }}>
      {rows.map((row) => (
        <MatchRowCard key={row.userId} row={row} revealed={revealed} colW={colW} />
      ))}
    </div>
  );
}

/**
 * Render a group's per-match board to PNG bytes: the group name, the fixture
 * (both teams + the live/final score, or "v" before kickoff), and every member's
 * prediction. Picks stay hidden until the match locks — exactly the privacy rule
 * the on-page board uses — so a pre-kickoff share shows who's locked in, not what
 * they picked, and a post-kickoff share shows the calls and points.
 */
export async function renderMatchPng(board: MatchBoard): Promise<Uint8Array> {
  const { match, revealed, rows, summary, group } = board;
  const homeName = teamLabel(match.homeCode, match.homeLabel);
  const awayName = teamLabel(match.awayCode, match.awayLabel);
  const stageLabel = match.trial ? "Practice" : formatStageLabel(match.groupLabel, match.stage);

  const score = match.result ?? match.live ?? null;
  const centerScore = score ? `${score.home}–${score.away}` : "v";
  const stateLabel = match.result
    ? "FULL TIME"
    : match.live
      ? `LIVE${match.live.minute ? ` ${match.live.minute}'` : ""}`
      : "Upcoming";
  const stateColor = match.result ? PITCH : match.live ? FLAME : MUTED;
  const caption = revealed
    ? `${summary.entered} of ${summary.total} predicted`
    : `${summary.entered} of ${summary.total} locked in · picks reveal at kickoff`;

  const { listCount, twoCol, rowsPerCol } = matchListLayout(rows.length);
  const shown = rows.slice(0, listCount);
  const overflow = rows.length - shown.length;
  const colW = twoCol ? TWO_COL_W : ONE_COL_W;
  const col1 = shown.slice(0, rowsPerCol);
  const col2 = shown.slice(rowsPerCol);
  const size = matchOgImageSize(rows.length);
  const font = loadFont();

  const res = new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
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
            justifyContent: "center",
            width: "100%",
            height: "100%",
            padding: "18px 34px",
            borderRadius: 32,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          {/* Header: group name + subtitle */}
          <div style={{ justifyContent: "center", fontSize: 40, fontWeight: 700, color: "#c4b5fd", maxWidth: 1000, ...clip }}>
            {group.name}
          </div>
          <div style={{ display: "flex", justifyContent: "center", fontSize: 20, fontWeight: 400, color: MUTED, marginTop: 2 }}>
            World Cup 2026 · {stageLabel}
          </div>

          {/* Fixture bar: home name · score tile · away name */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: COL_GAP, marginTop: 14 }}>
            <div style={{ display: "flex", width: MATCH_SIDE_W, justifyContent: "flex-end" }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: INK, maxWidth: MATCH_SIDE_W, ...clip }}>
                {homeName}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: MATCH_CENTER_W }}>
              <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: INK, lineHeight: 1 }}>{centerScore}</div>
              <div style={{ display: "flex", fontSize: 18, fontWeight: 700, color: stateColor, marginTop: 6 }}>{stateLabel}</div>
            </div>
            <div style={{ display: "flex", width: MATCH_SIDE_W, justifyContent: "flex-start" }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: INK, maxWidth: MATCH_SIDE_W, ...clip }}>
                {awayName}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", fontSize: 18, fontWeight: 400, color: MUTED, marginTop: 8 }}>
            {caption}
          </div>

          {/* Per-player predictions */}
          {shown.length > 0 && (
            <div style={{ display: "flex", gap: COL_GAP, marginTop: LIST_MARGIN_TOP, alignItems: "flex-start", justifyContent: "center" }}>
              <MatchColumn rows={col1} revealed={revealed} colW={colW} />
              {col2.length > 0 && <MatchColumn rows={col2} revealed={revealed} colW={colW} />}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 400, color: MUTED }}>
              {overflow > 0 ? `+${overflow} more` : `${summary.total} in the group`}
            </div>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 400, color: "#78716c" }}>
              worldcup.kachwalas.com
            </div>
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
  return new Uint8Array(await res.arrayBuffer());
}

// ── Personal achievements share image ────────────────────────────────────────
// A player's scorecard within a group: points, how many they've predicted, and
// their 🔥 streak / 🎯 exact-score badges. Rendered on demand by the
// /s/<code>/p/<id>/og endpoint behind the same short CDN cache (these only move
// as results confirm). Fixed 1200x630 — a compact card, not a growing list.

const SUNBURST = "#f59e0b"; // exact-score accent (matches the on-page 🎯 chip)

/** The PNG dimensions for the achievements card — a fixed link-unfurl frame. */
export function achievementOgImageSize(): { width: number; height: number } {
  return { width: OG_WIDTH, height: OG_MIN_HEIGHT };
}

const STAT_TILE_W = 244;
const STAT_TILE_H = 196;

/** One big-number stat tile (glass), optionally led by an inline icon. */
function StatTile({
  value,
  label,
  color,
  icon,
}: {
  value: string;
  label: string;
  color: string;
  icon?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: STAT_TILE_W,
        height: STAT_TILE_H,
        borderRadius: 28,
        background: GLASS,
        border: GLASS_BORDER,
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <img src={icon} width={44} height={52} alt="" />}
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      </div>
      <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </div>
    </div>
  );
}

/**
 * Render a player's achievements card to PNG bytes: their name, the group, and a
 * row of stat tiles — points, matches predicted, and (when earned) the 🔥
 * scoring streak and 🎯 exact-score count. Badges below their threshold are
 * omitted, and the remaining tiles stay centred. Aggregates only — no hidden
 * pick is ever drawn.
 */
export async function renderAchievementsPng(data: {
  displayName: string;
  groupName: string;
  points: number;
  predicted: number;
  total: number;
  streak: number;
  exact: number;
}): Promise<Uint8Array> {
  const size = achievementOgImageSize();
  const font = loadFont();

  const tiles: React.ReactNode[] = [
    <StatTile key="pts" value={`${data.points}`} label="Points" color={INK} />,
    <StatTile key="pred" value={`${data.predicted}/${data.total}`} label="Predicted" color={INK} />,
  ];
  if (data.streak >= 2) {
    tiles.push(
      <StatTile key="streak" value={`${data.streak}`} label="In a row" color={FLAME} icon={FLAME_ICON} />,
    );
  }
  if (data.exact >= 1) {
    tiles.push(
      <StatTile key="exact" value={`${data.exact}`} label="Exact scores" color={SUNBURST} />,
    );
  }

  const res = new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
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
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
            padding: "18px 34px",
            borderRadius: 32,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          {/* Name + group */}
          <div style={{ fontSize: 60, fontWeight: 700, color: "#c4b5fd", maxWidth: 1000, ...clip }}>
            {data.displayName}
          </div>
          <div style={{ fontSize: 24, fontWeight: 400, color: MUTED, marginTop: 4, maxWidth: 1000, ...clip }}>
            {data.groupName} · World Cup 2026
          </div>

          {/* Stat tiles */}
          <div style={{ display: "flex", gap: COL_GAP, marginTop: 40, alignItems: "center", justifyContent: "center" }}>
            {tiles}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", fontSize: 20, fontWeight: 400, color: "#78716c", marginTop: 40 }}>
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
  return new Uint8Array(await res.arrayBuffer());
}
