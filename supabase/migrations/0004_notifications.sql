-- Email notifications.
--
-- Two additions, both supporting the daily "predictions are open" email:
--   * users gains an opt-out flag and an opaque unsubscribe token, so an
--     unsubscribe link can flip the flag without exposing the user id.
--   * notified_match_days is a send log keyed by the match-day's window-open
--     instant, so the every-minute cron emails each match-day exactly once.

alter table users
  add column if not exists email_opt_out boolean not null default false,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create table if not exists notified_match_days (
  match_day   text primary key,        -- window-open instant (ISO 8601), one per match-day
  notified_at timestamptz not null default now(),
  recipients  integer not null default 0
);
