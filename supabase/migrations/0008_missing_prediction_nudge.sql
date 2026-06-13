-- "You have predictions missing" nudge.
--
-- A per-user reminder sent ~1 hour before a match-day's first kickoff, to
-- members who still haven't predicted one or more of that day's matches. It's
-- separate from the broadcast "predictions are open" email (notified_match_days),
-- so this log keeps its own exactly-once claim keyed by the match-day's
-- window-open instant — the same identifier notified_match_days uses, so a
-- match-day means the same thing in both tables.

create table if not exists nudged_match_days (
  match_day   text primary key,        -- window-open instant (ISO 8601), one per match-day
  notified_at timestamptz not null default now(),
  recipients  integer not null default 0
);
