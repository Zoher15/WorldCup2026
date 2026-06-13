-- Per-match "you have predictions missing" nudge.
--
-- Supersedes the per-match-day nudge (nudged_match_days): the reminder now fires
-- ~1 hour before EACH game's kickoff, to the members who still haven't predicted
-- that specific match — so a forgotten late game gets its own hour-out reminder
-- instead of a single day-level nudge tied to the day's first kickoff.
--
-- One claim row per match makes the send exactly-once across overlapping cron
-- ticks, the same pattern notified_match_days / nudged_match_days use. The old
-- nudged_match_days table is left in place (harmless) but is no longer written.

create table if not exists nudged_matches (
  match_id    uuid primary key references matches(id) on delete cascade,
  notified_at timestamptz not null default now(),
  recipients  integer not null default 0
);
