-- World Cup 2026 Prediction Game — initial schema
--
-- Design decisions baked in here:
--   * Predictions belong to the PERSON, not the group: one prediction per
--     (user, match), reused across every group the user is in. See `predictions`.
--   * A person can be in many groups with a different display name in each.
--     See `memberships.display_name`.
--   * Groups choose how late joiners are scored via `groups.late_join_policy`.
--   * Live scores are written by a single server-side poller into `matches`
--     (status / minute / last_synced_at); browsers read via Supabase Realtime.
--   * Final results are gated by `matches.result_confirmed` so a wrong API
--     value can never silently award points.
--
-- Auth note: identity is lightweight (device-stored, optional recovery code),
-- not Supabase Auth. All writes go through server-side API routes using the
-- service role; RLS is enabled and denies direct anonymous writes.

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- People (thin persistent identity)
-- ---------------------------------------------------------------------------
create table users (
  id            uuid primary key default gen_random_uuid(),
  -- short code a user can enter to reclaim their identity on a new device
  recovery_code text unique,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Groups (a competition / leaderboard over shared predictions)
-- ---------------------------------------------------------------------------
create table groups (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,        -- short join code (e.g. "FAM7X2")
  name             text not null,
  -- how to score members who join partway through the tournament
  late_join_policy text not null default 'carry_over'
                   check (late_join_policy in ('carry_over', 'start_even')),
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Memberships (person <-> group, with a per-group display name)
-- ---------------------------------------------------------------------------
create table memberships (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  group_id     uuid not null references groups(id) on delete cascade,
  display_name text not null,                   -- "Dad" here, "Zoher" elsewhere
  is_admin     boolean not null default false,
  joined_at    timestamptz not null default now(),
  unique (user_id, group_id)
);

create index memberships_group_idx on memberships(group_id);
create index memberships_user_idx  on memberships(user_id);

-- ---------------------------------------------------------------------------
-- Matches (the global WC2026 schedule + live state + result)
-- ---------------------------------------------------------------------------
create table matches (
  id               uuid primary key default gen_random_uuid(),
  external_ref     text unique,                 -- id from the data source, for syncing
  match_number     int unique,                  -- official 1..104
  stage            text not null
                   check (stage in ('group','round_of_32','round_of_16',
                                    'quarter_final','semi_final','third_place','final')),
  group_label      text,                        -- 'A'..'L' for the group stage
  home_team        text,                        -- may be a placeholder for knockouts
  away_team        text,
  home_code        text,                        -- 3-letter code, nullable until known
  away_code        text,
  kickoff_at       timestamptz not null,
  venue            text,

  -- live + result state (written by the server-side poller / admin)
  status           text not null default 'scheduled'
                   check (status in ('scheduled','live','finished','postponed','cancelled')),
  minute           int,                         -- live clock when status = 'live'
  home_goals       int check (home_goals is null or home_goals >= 0),
  away_goals       int check (away_goals is null or away_goals >= 0),
  advanced_code    text,                        -- knockouts: who progressed (after ET/pens)
  result_confirmed boolean not null default false,  -- admin gate before points are awarded
  last_synced_at   timestamptz
);

create index matches_kickoff_idx on matches(kickoff_at);
create index matches_status_idx  on matches(status);

-- ---------------------------------------------------------------------------
-- Predictions (GLOBAL: one per person per match, shared across all groups)
-- ---------------------------------------------------------------------------
create table predictions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  match_id     uuid not null references matches(id) on delete cascade,
  pred_home    int not null check (pred_home >= 0),
  pred_away    int not null check (pred_away >= 0),
  advance_pick text,                            -- knockouts: predicted team to advance
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, match_id)
);

create index predictions_match_idx on predictions(match_id);

-- ---------------------------------------------------------------------------
-- Cached scores (output of the scoring engine, per prediction)
-- ---------------------------------------------------------------------------
create table match_scores (
  prediction_id    uuid primary key references predictions(id) on delete cascade,
  outcome_points   int not null,                -- 0 / 3 / 6
  closeness_points int not null,                -- 0..4
  advance_points   int not null default 0,      -- knockout bonus
  total_points     int not null,
  computed_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Lock predictions at kickoff: no inserts or edits once the match has started.
-- ---------------------------------------------------------------------------
create or replace function enforce_prediction_lock()
returns trigger language plpgsql as $$
declare
  ko timestamptz;
begin
  select kickoff_at into ko from matches where id = new.match_id;
  if ko is null then
    raise exception 'match % does not exist', new.match_id;
  end if;
  if now() >= ko then
    raise exception 'predictions for this match are locked (kickoff was %)', ko;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger predictions_lock
  before insert or update on predictions
  for each row execute function enforce_prediction_lock();

-- ---------------------------------------------------------------------------
-- Row Level Security: enable everywhere; writes happen via the service role
-- on the server. (Granular read policies for the anon key are added once the
-- client read paths are finalized.)
-- ---------------------------------------------------------------------------
alter table users        enable row level security;
alter table groups       enable row level security;
alter table memberships  enable row level security;
alter table matches      enable row level security;
alter table predictions  enable row level security;
alter table match_scores enable row level security;
