"use client";

import { Button } from "./Button";
import { Icon } from "./Icon";
import { MatchCard, toMatchCardData } from "./MatchCard";
import { LIVE_TEXT, PREDICTION_TEXT, RESULT_TEXT } from "./theme";
import { useLiveRefresh } from "./useLiveRefresh";
import { computeBreakdown } from "@/lib/score-breakdown";
import { isFinal, isInPlay, isLive } from "@/lib/match-predicates";
import type { PlayerPredictionRow, PlayerProfile } from "@/lib/player";

/** A single match in a player's profile, rendered as the shared scoreboard —
 *  identical whether it's the viewer's own card or another group member's,
 *  except the pick label says whose call it is. */
function PlayerCard({
  row,
  isBot,
  pickLabel,
}: {
  row: PlayerPredictionRow;
  isBot: boolean;
  pickLabel?: string;
}) {
  // Live (in-play) reads as "live"; a confirmed result as "final"; otherwise the
  // card keeps its prediction-window state (upcoming / open / locked-awaiting).
  const data = toMatchCardData(row);

  const status =
    row.state === "locked" ? (
      <PastStatus row={row} />
    ) : (
      <FutureStatus row={row} isBot={isBot} />
    );

  return (
    <MatchCard
      data={data}
      pick={
        row.pick
          ? {
              home: row.pick.home,
              away: row.pick.away,
              advancePick: row.pick.advancePick,
            }
          : null
      }
      pickLabel={pickLabel}
      status={status}
      detailHref={`/m/${row.matchId}`}
    />
  );
}

/**
 * Past (kicked-off) match: the pick and the actual score both live in the focal
 * tile, so this header chip stays out of their way and just reports the POINTS —
 * the earned total at full time, or a live projection (the same "~" the tile
 * uses) while the match is still in play. (It used to repeat the pick scoreline,
 * which the tile already shows.)
 */
function PastStatus({ row }: { row: PlayerPredictionRow }) {
  if (row.pick && row.points != null) {
    return <span className={`font-black ${RESULT_TEXT}`}>+{row.points} pts</span>;
  }
  if (!row.pick) return <span className="text-stone-400">No pick</span>;
  // Live: no confirmed points yet — project the running total from their pick
  // against the in-play score, matching the tile's provisional "~N pts".
  if (isLive(row) && row.live) {
    const b = computeBreakdown({
      pick: {
        home: row.pick.home,
        away: row.pick.away,
        advancePick: row.pick.advancePick,
      },
      result: { home: row.live.home, away: row.live.away },
      stage: row.stage,
      homeCode: row.homeCode,
      awayCode: row.awayCode,
    });
    return <span className={`font-black ${LIVE_TEXT}`}>~{b.total} pts</span>;
  }
  if (row.result == null) return <span className="text-stone-400">Awaiting</span>;
  return <span className="text-stone-400">Pre-join</span>;
}

/** Open/upcoming match: the pick stays private — only entered-or-not is shown. */
function FutureStatus({ row, isBot }: { row: PlayerPredictionRow; isBot: boolean }) {
  if (isBot) return <span className={PREDICTION_TEXT}>Predicts 0–0</span>;
  if (row.pick) return <span className="text-emerald-400">✓ Entered</span>;
  if (row.hasPrediction)
    return (
      <span className="inline-flex items-center gap-1 text-stone-300">
        <Icon name="lock" /> Hidden
      </span>
    );
  return <span className="text-stone-400">Not entered</span>;
}

function Section({
  title,
  rows,
  empty,
  isBot,
  pickLabel,
}: {
  title: React.ReactNode;
  rows: PlayerPredictionRow[];
  empty: string;
  isBot: boolean;
  pickLabel?: string;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-stone-400">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-2xl glass px-4 py-3 text-sm font-medium text-stone-400">
          {empty}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {rows.map((r) => (
            <PlayerCard key={r.matchId} row={r} isBot={isBot} pickLabel={pickLabel} />
          ))}
        </div>
      )}
    </section>
  );
}

export function PlayerPredictions({
  profile,
  view = "current",
  highlightIds = [],
}: {
  profile: PlayerProfile;
  /** "current" shows live/open/upcoming (plus the edit button on your own
   *  profile); "past" shows only finished matches — their own page, mirroring
   *  the predict → past-results split. */
  view?: "current" | "past";
  /** Matches to highlight (and anchor to) — the badge chips link here with the
   *  matches the badge was earned on. */
  highlightIds?: string[];
}) {
  const { isBot, isViewer } = profile.player;
  const inPlay = profile.rows.filter(isInPlay);
  // The card tiles say whose call a pick is: yours on your own profile, theirs
  // on a group-mate's, the bot's on the baseline.
  const pickLabel = isViewer ? undefined : isBot ? "bot's call" : "their call";

  // Tick scores forward while any match on this profile is in play (only the
  // current view carries in-play cards; the past page never does).
  useLiveRefresh(view === "current" && inPlay.length > 0);

  if (view === "past") {
    // Only finalized (confirmed-result) matches, most-recent first. In-play and
    // awaiting-confirmation matches stay in the current view.
    const past = profile.rows.filter(isFinal).reverse();
    if (past.length === 0) {
      return (
        <div className="rounded-2xl glass p-6 text-center font-medium text-stone-300">
          <div className="mb-2 text-4xl">⚽</div>
          No finished matches yet — they&apos;ll appear here after kickoff.
        </div>
      );
    }
    const highlight = new Set(highlightIds);
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {past.map((r) => (
          <div
            key={r.matchId}
            id={`m-${r.matchId}`}
            className={
              highlight.has(r.matchId)
                ? "rounded-2xl ring-2 ring-sunburst scroll-mt-24"
                : "scroll-mt-24"
            }
          >
            <PlayerCard row={r} isBot={isBot} pickLabel={pickLabel} />
          </div>
        ))}
      </div>
    );
  }

  const open = profile.rows.filter((r) => r.state === "open");
  const upcoming = profile.rows.filter((r) => r.state === "upcoming");

  return (
    <div>
      {inPlay.length > 0 && (
        <Section
          title={
            // Blinking flame dot — the same live cue as the match card's
            // top-right LIVE pill — in place of the static 🔴 emoji.
            <span className="inline-flex items-center gap-1.5">
              <span className="live-dot h-2 w-2 rounded-full bg-flame" />
              Live now
            </span>
          }
          rows={inPlay}
          empty=""
          isBot={isBot}
          pickLabel={pickLabel}
        />
      )}
      <Section
        title="Open now"
        rows={open}
        empty="No matches are open for prediction right now."
        isBot={isBot}
        pickLabel={pickLabel}
      />
      <Section
        title="Upcoming"
        rows={upcoming}
        empty="Nothing on the horizon yet."
        isBot={isBot}
        pickLabel={pickLabel}
      />

      {profile.player.isViewer && (
        <Button as="link" href="/predict" tone="pitch" size="lg" className="mt-2 inline-block">
          ⚽ Edit your predictions
        </Button>
      )}
    </div>
  );
}
