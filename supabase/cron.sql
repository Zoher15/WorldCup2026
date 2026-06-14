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

-- Note: /api/poll also drains the shared email queue (email_queue — sign-in
-- codes AND match-day digests) on each run, at Resend's rate limit. The
-- every-minute cadence below is what keeps a backlog moving, so no extra cron
-- job is needed for email delivery.

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

-- Match-day digest email. Runs every 15 minutes; the endpoint enqueues ONE
-- consolidated per-user email about an hour before a match-day's first kickoff —
-- the day's matches with each member's picks marked, what they're still missing,
-- how far they've climbed, and per-group social proof of who's already in —
-- exactly once per match-day (claimed in notified_match_days). A coarse interval
-- is plenty: the 1h lead window spans several ticks. Requires RESEND_API_KEY +
-- EMAIL_FROM set in Vercel — otherwise the endpoint is a no-op. Same CRON_SECRET.
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
