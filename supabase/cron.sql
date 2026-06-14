-- Schedule the live-score poller with Supabase pg_cron.
--
-- Why Supabase and not Vercel: Vercel's free (Hobby) plan caps cron at ONCE
-- PER DAY, so it can't drive live polling. Supabase pg_cron runs every minute
-- for free. Our /api/poll endpoint is budget-aware (pollIfDue): it only spends
-- a football-data request when a match is actually live and the planner's
-- interval has elapsed, so an every-minute cron stays within the free quota.
--
-- Prerequisites:
--   1. Set CRON_SECRET in Vercel (and redeploy). Use the SAME value below.
--   2. Run this in the Supabase SQL Editor.

-- Note: /api/poll also drains the sign-in code queue (login_email_queue) on each
-- run, sending queued codes at Resend's per-minute limit. The every-minute
-- cadence below is what keeps a backlog moving, so no extra cron job is needed
-- for sign-in emails.

-- Enable the scheduler + HTTP client (or enable via Dashboard → Database → Extensions).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace YOUR_CRON_SECRET with the value you set in Vercel.
select cron.schedule(
  'worldcup-poll',
  '* * * * *', -- every minute; the endpoint decides when to actually call the API
  $$
  select net.http_get(
    url := 'https://worldcup.kachwalas.com/api/poll?secret=YOUR_CRON_SECRET'
  );
  $$
);

-- Prediction emails. Runs every 15 minutes; the endpoint drives two
-- exactly-once sends: the "predictions are open" announcement (once per
-- match-day at window-open) and the per-user "you've still got picks missing"
-- nudge (ONE email ~1h before a match-day's FIRST kickoff, to members who
-- haven't finished the day, with per-group social proof of who's already in). A
-- coarse interval is plenty — the nudge just lands within ~15 min of the 1h
-- mark, and the day's 1h lead window spans several ticks. Requires
-- RESEND_API_KEY + EMAIL_FROM set in Vercel — otherwise the endpoint is a no-op.
-- Same CRON_SECRET.
select cron.schedule(
  'worldcup-notify',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://worldcup.kachwalas.com/api/notify?secret=YOUR_CRON_SECRET'
  );
  $$
);

-- Useful management commands:
--   select * from cron.job;                       -- list scheduled jobs
--   select * from cron.job_run_details
--     order by start_time desc limit 20;          -- recent runs
--   select cron.unschedule('worldcup-poll');      -- stop polling
--   select cron.unschedule('worldcup-notify');    -- stop the daily email
