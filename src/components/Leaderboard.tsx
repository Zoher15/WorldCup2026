"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { InfoBadge } from "./InfoBadge";
import { PlayerLink } from "./PlayerLink";
import { ShareLeaderboard } from "./ShareLeaderboard";
import { FOCUS_RING } from "./theme";
import { useLiveRefresh } from "./useLiveRefresh";
import {
  competitionRanks,
  KNOCKOUT_ROUNDS,
  type KnockoutRound,
  type StageBreakdown,
  type Standings,
} from "@/lib/standings";

const TABS = [
  { key: "overall", label: "Overall" },
  { key: "win", label: "Outcome predictor" },
  { key: "scoreline", label: "Scoreline" },
] as const;

// The stage scope (top control). "all" is the whole tournament — the board's
// resting state, identical to having no scope at all.
const SCOPES = [
  { key: "all", label: "All" },
  { key: "group", label: "Group" },
  { key: "knockout", label: "Knockout" },
] as const;
type Scope = (typeof SCOPES)[number]["key"];

// Short chip labels for each knockout round, in bracket order.
const ROUND_LABEL: Record<KnockoutRound, string> = {
  round_of_32: "R32",
  round_of_16: "R16",
  quarter_final: "QF",
  semi_final: "SF",
  final: "Final",
};

// Medal tone, colour and height are all indexed by rank (0 = 1st), never by
// podium position — so tied places match: two co-leaders both stand on
// equal-height gold steps, two tied for 2nd on matching silver, and so on.

// The medal glyph: a trophy on the gold step (the prize), a medal on the rest.
// Indexed by rank, so a tie at the top hands both leaders the trophy.
const MEDAL_ICON = ["trophy", "medal", "medal"] as const;
// The icon's metal tint, again by rank.
const MEDAL_TONE = ["text-amber-200", "text-zinc-100", "text-amber-300"];
// Each metal as a vertical gradient *plus* a radial sheen highlight, so the
// step reads as a curved bar of polished metal catching the light rather than a
// flat swatch. Silver is a true bright nickel (light top, mid-grey foot) so it
// reads as proud metal, not a disabled grey. Bronze stays deep copper so it
// never looks like a second gold.
const PODIUM_BG = [
  "bg-[radial-gradient(120%_90%_at_30%_0%,#fde68a_0%,#f59e0b_45%,#b45309_100%)]",
  "bg-[radial-gradient(120%_90%_at_30%_0%,#ffffff_0%,#cbd5e1_45%,#64748b_100%)]",
  "bg-[radial-gradient(120%_90%_at_30%_0%,#fcd9a8_0%,#b45309_45%,#7c2d12_100%)]",
];
// Render order places #1 in the middle, #2 left, #3 right.
const PODIUM_ORDER = [1, 0, 2];
// The winner's bar is tallest, descending from there (by rank, so ties match).
const PODIUM_HEIGHT = ["h-28", "h-20", "h-16"];

/** Rank movement since the last digest. The server emits 0 today
 *  (`buildStandings` doesn't diff snapshots) and a live climb is shown by the
 *  `overtake-flash` wash instead — so a real arrow is drawn ONLY when the value
 *  is actually non-zero, rather than a dead grey dash on every row. */
function Movement({ value }: { value: number }) {
  if (value === 0) return null;
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-bold ${up ? "text-emerald-400" : "text-flame"}`}
      title={`${up ? "Up" : "Down"} ${Math.abs(value)}`}
    >
      <Icon name={up ? "arrow-up" : "arrow-down"} /> {Math.abs(value)}
    </span>
  );
}

/** The 🔥 scoring-streak flame, on the podium steps and the ranked rows alike.
 *  The glyph alone is cryptic, so it's tappable for a plain-language gloss (a
 *  hover `title` covers the desktop). `font-sans` resets the podium's display
 *  font for the count; harmless on the rows, which are sans already. `align`
 *  keeps the popover inside its column — the side podium steps open inward. */
function StreakBadge({
  streak,
  align,
}: {
  streak: number;
  align?: "left" | "center" | "right";
}) {
  return (
    <InfoBadge
      label={`${streak} correct results in a row`}
      align={align}
      triggerClassName="font-sans text-[10px] font-bold text-flame"
      explainer={
        <>
          🔥 <strong className="text-flame">On a streak</strong> — called the
          right result in {streak} matches in a row.
        </>
      }
    >
      🔥{streak}
    </InfoBadge>
  );
}

/** A knockout-round drill chip: the active round wears the chrome pill, played
 *  rounds sit on glass, and a round that hasn't happened yet is disabled rather
 *  than opening an empty board. */
function RoundChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Not played yet" : undefined}
      className={`rounded-full px-3 py-1 text-xs font-bold transition ${FOCUS_RING} ${
        disabled
          ? "cursor-not-allowed text-stone-600"
          : active
            ? "chrome text-violet-300"
            : "glass text-stone-300 hover:text-white active:scale-95"
      }`}
    >
      {children}
    </button>
  );
}

export function Leaderboard({
  data,
  stages,
  code,
  groupName,
  live = false,
  viewerId,
}: {
  data: Standings;
  /** The board sliced by stage / knockout round. When present, a scope control
   *  appears above the metric tabs; absent (the home-page demo) the board is
   *  the whole tournament only. */
  stages?: StageBreakdown;
  code?: string;
  groupName?: string;
  /** A match is in play — points are provisional; tick the board on a timer and
   *  flag it so people know the totals can still move. */
  live?: boolean;
  /** The signed-in viewer, so their own row can carry the "you vs them" delta.
   *  Omitted where there's no viewer (the home-page demo board). */
  viewerId?: string;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overall");
  const [scope, setScope] = useState<Scope>("all");
  // Which knockout round is drilled into; null = the knockouts as a whole. Only
  // meaningful while scope === "knockout".
  const [round, setRound] = useState<KnockoutRound | null>(null);
  const [expanded, setExpanded] = useState(false);

  // The board the controls currently point at, and whether it has been scored
  // yet (so an unplayed round shows "not started" rather than an empty podium).
  const scoped =
    !stages
      ? null
      : scope === "all"
        ? stages.all
        : scope === "group"
          ? stages.group
          : round
            ? stages.rounds[round]
            : stages.knockout;
  const activeStandings = scoped ? scoped.standings : data;
  const hasResults = scoped ? scoped.hasResults : true;
  // Identifies the exact board on screen (scope + round + metric). Keys the
  // overtake-flash history and the row DOM so switching any of the three starts
  // from a clean slate instead of bleeding one board's points/positions into
  // another (see the per-tab note on the row key below).
  const boardKey = `${scope}:${round ?? ""}:${tab}`;
  const rows = activeStandings[tab];
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  // Tied players share a rank ("=4"), competition style.
  const ranks = competitionRanks(rows);
  const isTied = (i: number) =>
    (i > 0 && rows[i - 1].points === rows[i].points) ||
    (i < rows.length - 1 && rows[i + 1].points === rows[i].points);

  // "You vs them": one small motivating line for the viewer — every tie-mate
  // when level, crown on top, otherwise the gap to the player directly above.
  const viewerIdx = viewerId ? rows.findIndex((r) => r.userId === viewerId) : -1;
  let viewerDelta: string | null = null;
  if (viewerIdx >= 0) {
    const mine = rows[viewerIdx].points;
    const tiedOthers = rows.filter(
      (r, i) => i !== viewerIdx && r.points === mine,
    );
    if (tiedOthers.length > 0) {
      const lead = ranks[viewerIdx] === 1 ? "Tied for the lead with" : "Tied with";
      viewerDelta =
        tiedOthers.length === 1
          ? `${lead} ${tiedOthers[0].displayName}`
          : `${lead} ${tiedOthers.length} others`;
    } else if (viewerIdx === 0) {
      // Leader: give them a lead to defend — the gap to the nearest chaser.
      const chaser = rows[viewerIdx + 1];
      const lead = chaser ? mine - chaser.points : 0;
      viewerDelta = chaser
        ? `👑 Top — ${lead} pt${lead === 1 ? "" : "s"} clear of ${chaser.displayName}`
        : "👑 Top of the group";
    } else {
      // Behind: name the gap, but point forward — it's one good round away.
      const ahead = rows[viewerIdx - 1];
      const gap = ahead.points - mine;
      viewerDelta = `${gap} pt${gap === 1 ? "" : "s"} behind ${ahead.displayName} — one good round closes it`;
    }
  }
  // Show the top 10 (podium + 7) by default so the share button stays in reach;
  // the rest is revealed on demand via the expander above the share button.
  const COLLAPSED_TOTAL = 10;
  const collapsedRest = rest.slice(0, COLLAPSED_TOTAL - top3.length);
  const shownRest = expanded ? rest : collapsedRest;
  const canExpand = rest.length > collapsedRest.length;

  // Refresh the board while a match is live so provisional points keep up.
  useLiveRefresh(live);

  // Overtake flash: remember where each player ranked the last time this tab's
  // rows rendered (per tab, so switching tabs never cross-wires the boards).
  // When a live refresh swaps in new standings and someone has climbed, their
  // row — and podium slot — wears a brief gold wash. The server's `movement`
  // field can't drive this (buildStandings always emits 0), so the comparison
  // lives client-side: ranks in a ref (comparing never re-renders by itself),
  // and the climbers in state so the overlay *mounts* — the one-shot
  // `overtake-flash` CSS animation runs on mount — then unmounts once faded.
  // First sight of a tab only records, so page load never flashes.
  const prevRanks = useRef(new Map<string, Map<string, number>>());
  const [climbed, setClimbed] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const ranks = new Map(rows.map((r, i) => [r.userId, i]));
    const prev = prevRanks.current.get(boardKey);
    prevRanks.current.set(boardKey, ranks);
    if (!prev) return;
    const up = new Set<string>();
    for (const [id, rank] of ranks) {
      const before = prev.get(id);
      if (before !== undefined && rank < before) up.add(id);
    }
    if (up.size === 0) return;
    setClimbed(up);
    const t = setTimeout(() => setClimbed(new Set()), 1600);
    return () => clearTimeout(t);
  }, [rows, boardKey]);

  // What to say when the chosen scope/round hasn't been scored yet, instead of a
  // flat all-zeros podium. (Unplayed rounds are disabled, so the round message is
  // a belt-and-braces fallback.)
  const emptyMessage =
    scope === "group"
      ? "The group stage hasn't been scored yet."
      : scope === "knockout" && round === null
        ? "The knockouts haven't started yet."
        : round !== null
          ? `${ROUND_LABEL[round] === "Final" ? "The final" : `The ${ROUND_LABEL[round]} round`} hasn't been played yet.`
          : "No results yet — check back once matches are played.";

  return (
    <div className="rounded-3xl glass p-5">
      <h2 className="mb-4 flex items-center justify-center gap-2 text-center text-2xl font-black">
        <span>🏆 <span className="gradient-text">Leaderboard</span></span>
        {live && (
          <span className="inline-flex items-center gap-1 rounded-full glass px-2.5 py-0.5 text-xs font-bold text-flame">
            <span className="live-dot h-2 w-2 rounded-full bg-flame" />
            LIVE
          </span>
        )}
      </h2>
      {live && (
        <p className="-mt-2 mb-4 text-center text-xs font-medium text-stone-400">
          Points are provisional while matches are in play.
        </p>
      )}

      {/* Stage scope (only with a real breakdown): the whole tournament, the
          group stage, or the knockouts. Secondary to the metric tabs below, so
          a touch smaller. Picking Knockout reveals the round drill underneath;
          leaving it clears any drilled-in round. */}
      {stages && (
        <div className="mb-3">
          <div className="flex justify-center gap-1 rounded-full glass p-1">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  setScope(s.key);
                  if (s.key !== "knockout") setRound(null);
                }}
                className={`flex-1 rounded-full px-3 py-1 text-xs font-bold transition ${FOCUS_RING} ${
                  scope === s.key
                    ? "chrome text-emerald-300"
                    : "text-stone-300 hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {/* Round drill — appears only inside the knockouts (progressive
              disclosure, so the resting card stays one row taller, not two).
              "All" is the knockouts as a whole; each round chip narrows to it. */}
          {scope === "knockout" && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              <RoundChip active={round === null} onClick={() => setRound(null)}>
                All
              </RoundChip>
              {KNOCKOUT_ROUNDS.map((r) => (
                <RoundChip
                  key={r}
                  active={round === r}
                  disabled={!stages.rounds[r].hasResults}
                  onClick={() => setRound(r)}
                >
                  {ROUND_LABEL[r]}
                </RoundChip>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs: the active tab is a solid chrome pill; inactive tabs are muted
          text that brightens on hover. */}
      <div className="mb-5 flex justify-center gap-1 rounded-full glass p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition ${FOCUS_RING} ${
              tab === t.key
                ? "chrome text-violet-300"
                : "text-stone-300 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {hasResults ? (
      <>
      {/* Podium */}
      <div className="mb-5 flex items-end justify-center gap-3 max-sm:gap-2">
        {PODIUM_ORDER.map((idx, slot) => {
          const r = top3[idx];
          if (!r)
            return (
              <div key={slot} className="w-20 max-sm:max-w-24 max-sm:flex-1 max-sm:w-auto" />
            );
          // Rank (not podium position) drives the medal, colour and height, so
          // tied places match — two level at the top both wear the gold trophy
          // on equal-height gold steps, and the player below them takes bronze.
          const rank = ranks[idx];
          return (
            <div
              key={slot}
              // Steps rise into place on mount; the centre (winner) lands last
              // so the eye finishes on the gold. Keyed by slot, so this plays
              // once on first paint, not on every live refresh.
              className="rise-in flex w-20 flex-col items-center max-sm:max-w-24 max-sm:flex-1 max-sm:w-auto"
              style={{ animationDelay: slot === 1 ? "0.16s" : slot === 2 ? "0.08s" : "0s" }}
              title={isTied(idx) ? `Tied at ${r.points} pts` : undefined}
            >
              <div
                className={`mb-1 drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)] ${MEDAL_TONE[rank - 1]} ${
                  rank === 1 ? "text-3xl" : "text-2xl"
                }`}
              >
                <Icon name={MEDAL_ICON[rank - 1]} />
              </div>
              {/* No profile to link to without a group (BoringBot has a synthetic one). */}
              <PlayerLink
                userId={r.userId}
                code={code}
                title={r.displayName}
                className="mb-1 max-w-full truncate text-xs font-bold"
              >
                {r.displayName}
              </PlayerLink>
              {/* Glass sheet floating over the metallic medal gradient — the
                  polished gold/silver/bronze glows through the frost, matching
                  the "glass over flags" treatment on the match cards. */}
              <div className={`relative w-full ${PODIUM_HEIGHT[rank - 1]}`}>
                <div
                  className={`absolute inset-0 overflow-hidden rounded-t-xl ${PODIUM_BG[rank - 1]}${
                    rank === 1 ? " shine" : ""
                  }`}
                />
                <div className="absolute inset-0 rounded-t-xl glass" />
                {/* Gold flash when a riser just took (or rose within) this slot. */}
                {climbed.has(r.userId) && (
                  <span
                    aria-hidden
                    className="overtake-flash pointer-events-none absolute inset-0 rounded-t-xl"
                  />
                )}
                <div className="relative flex h-full flex-col items-center gap-0.5 pt-1 font-display text-stone-50">
                  <span>
                    {isTied(idx) && (
                      <span className="mr-0.5 text-stone-300">=</span>
                    )}
                    {r.points}
                  </span>
                  {(r.streak ?? 0) >= 2 && (
                    <StreakBadge
                      streak={r.streak ?? 0}
                      align={slot === 0 ? "left" : slot === 2 ? "right" : "center"}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* A podium-placed viewer gets their delta line under the podium (their
          slot is too tight to carry an extra line without breaking alignment). */}
      {viewerIdx >= 0 && viewerIdx < 3 && viewerDelta && (
        <p className="-mt-3 mb-5 text-center text-xs font-medium text-stone-400">
          {viewerDelta}
        </p>
      )}

      {/* The rest */}
      <ol className="space-y-2">
        {shownRest.map((r, i) => {
          const rowIdx = i + top3.length;
          const tied = isTied(rowIdx);
          const streak = (r.streak ?? 0) >= 2 && (
            <StreakBadge streak={r.streak ?? 0} />
          );
          return (
          <li
            // Scope the row key to the active board (scope + round + metric).
            // Rows are identity-keyed (by userId) so a live refresh can reorder
            // them in place and flash climbers WITHIN a board. But that identity
            // also let React reuse a row's DOM across a board SWITCH — where it
            // could keep the previous board's points and position, bleeding e.g.
            // an Overall total into the Scoreline board, or a Group total into a
            // knockout round. The positionally-keyed podium never showed this;
            // prefixing the boardKey gives the list the same clean slate.
            key={`${boardKey}-${r.userId}`}
            // Rows settle in with a short stagger; `backwards` fill means the
            // entrance never pins the transform, so the hover lift still works.
            style={{ animationDelay: `${Math.min(i * 0.04, 0.28)}s` }}
            className="rise-in relative flex items-center gap-3 rounded-2xl glass px-4 py-3 text-stone-100 transition hover:scale-[1.01]"
          >
            {/* Gold flash overlay (rather than animating the row's own
                background, which would fight the .glass layers) when this
                player climbed in the latest refresh. */}
            {climbed.has(r.userId) && (
              <span
                aria-hidden
                className="overtake-flash pointer-events-none absolute inset-0 rounded-2xl"
              />
            )}
            {/* Tied players share a rank ("=4"), competition style. */}
            <span
              className="w-7 text-center font-black text-stone-400 tabular-nums"
              title={tied ? `Tied at ${r.points} pts` : undefined}
            >
              {tied ? "=" : ""}
              {ranks[rowIdx]}
            </span>
            {viewerId === r.userId && viewerDelta ? (
              // The viewer's row: their name plus the small "you vs them" delta
              // tucked under it, inside the same flex slot so the rank, avatar
              // and points columns stay aligned with every other row.
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-1.5">
                  <PlayerLink
                    userId={r.userId}
                    code={code}
                    title={r.displayName}
                    className="truncate font-bold"
                  >
                    {r.displayName}
                  </PlayerLink>
                  {streak}
                </span>
                <span className="truncate text-xs font-medium text-stone-400">
                  {viewerDelta}
                </span>
              </span>
            ) : (
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <PlayerLink
                  userId={r.userId}
                  code={code}
                  title={r.displayName}
                  className="truncate font-bold"
                >
                  {r.displayName}
                </PlayerLink>
                {streak}
              </span>
            )}
            <Movement value={r.movement} />
            <span className="w-10 text-right font-display text-lg tabular-nums">
              {r.points}
            </span>
          </li>
          );
        })}
      </ol>
      </>
      ) : (
        // The chosen scope/round hasn't been scored yet — say so rather than
        // showing a podium of zeros.
        <div className="rounded-2xl glass p-8 text-center">
          <div className="float-bob mb-2 text-4xl">⚽</div>
          <p className="font-medium text-stone-300">{emptyMessage}</p>
        </div>
      )}

      {((hasResults && canExpand) || code) && (
        <div className="mt-5 flex flex-col items-center gap-3">
          {hasResults && canExpand && (
            <button
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className={`rounded-full chrome px-4 py-2 text-sm font-bold text-violet-300 transition active:scale-95 ${FOCUS_RING}`}
            >
              {expanded ? "Show less" : `Show all ${rows.length} →`}
            </button>
          )}
          {code && <ShareLeaderboard code={code} groupName={groupName} />}
        </div>
      )}
    </div>
  );
}
