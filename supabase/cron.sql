-- Schedule the live-score poller with Supabase pg_cron.
--
-- Why Supabase and not Vercel: Vercel's free (Hobby) plan caps cron at ONCE
-- PER DAY, so it can't drive live polling. Supabase pg_cron runs every minute
-- for free. Our /api/poll endpoint is budget-aware (pollIfDue): it only spends
-- an API-Football request when a match is actually live and the planner's
-- interval has elapsed, so an every-minute cron stays within the free quota.
--
-- Prerequisites:
--   1. Set CRON_SECRET in Vercel (and redeploy). Use the SAME value below.
--   2. Run this in the Supabase SQL Editor.

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

-- Useful management commands:
--   select * from cron.job;                       -- list scheduled jobs
--   select * from cron.job_run_details
--     order by start_time desc limit 20;          -- recent runs
--   select cron.unschedule('worldcup-poll');      -- stop polling
