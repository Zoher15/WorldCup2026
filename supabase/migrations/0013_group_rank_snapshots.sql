-- Remember each member's leaderboard position per group, so the match-day digest
-- can tell them how far they've climbed since the last one.
--
-- The digest is the natural cadence: each time a match-day's digest goes out we
-- compute every member's current OVERALL rank in each of their groups (the same
-- standard-competition rank the app shows, BoringBot included), report the climb
-- since the rank we stored last time, then overwrite the stored rank. So the
-- "you've moved up N spots" line measures movement between consecutive match-day
-- digests — roughly one match-day's worth. The first digest for a (group, member)
-- just records the baseline; movement shows from the next one on.
--
-- Written only by the server (service role), so RLS denies anon access.

create table if not exists group_rank_snapshots (
  group_id   uuid        not null references groups(id) on delete cascade,
  user_id    uuid        not null references users(id)  on delete cascade,
  -- The member's overall-board rank when this snapshot was taken (ties share a
  -- rank, 1-1-3 style, matching the app).
  rank       int         not null,
  -- The digest match-day (window-open instant, ISO 8601) this snapshot was
  -- captured at — informational, for debugging which send set it.
  match_day  text        not null,
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table group_rank_snapshots enable row level security;
