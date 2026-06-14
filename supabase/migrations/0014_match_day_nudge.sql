-- Revert the "predictions missing" nudge to a per-match-DAY send.
--
-- The nudge now fires ONCE per match-day, ~1 hour before that day's first
-- kickoff, in a single email per member who hasn't finished the day's games —
-- carrying per-group social proof ("9 of 9 of your group-mates are already in")
-- to nudge the laggards with a bit of FOMO. This supersedes the per-match nudge
-- (nudged_matches, migration 0009): one email per day instead of one per game.
--
-- The claim moves back to nudged_match_days (migration 0008), whose match_day PK
-- already keys exactly-once sends to the window-open instant — the same id
-- notified_match_days uses. It's recreated here idempotently for clarity / fresh
-- installs; the per-match nudged_matches table is left in place (harmless) but
-- is no longer written.

create table if not exists nudged_match_days (
  match_day   text primary key,        -- window-open instant (ISO 8601), one per match-day
  notified_at timestamptz not null default now(),
  recipients  integer not null default 0
);
