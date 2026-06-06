# Deployment

The app runs on **Vercel** (free), with data on **Supabase** (free), reached at
**worldcup.kachwalas.com** — a subdomain of your existing Squarespace domain.
Your main `kachwalas.com` site is untouched.

```
kachwalas.com           → Squarespace (existing site)
worldcup.kachwalas.com  → Vercel (this app)  ──>  Supabase (Postgres)
```

## 1. Supabase (database)

1. Create a free project at https://supabase.com.
2. In the SQL editor, run the migration in `supabase/migrations/0001_init.sql`.
3. From **Settings → API**, copy the **Project URL**, the **anon** key, and the
   **service_role** key (keep this one secret).

## 2. Vercel (app)

1. Sign in at https://vercel.com with GitHub and **import this repository**.
   Vercel auto-detects Next.js — no build config needed.
2. Under **Settings → Environment Variables**, add the values from
   `.env.example` (Supabase URL/keys, `FOOTBALL_API_KEY`, `CRON_SECRET`,
   `ADMIN_PASSCODE`, `NEXT_PUBLIC_APP_URL`). `ADMIN_PASSCODE` gates the
   `/admin` results page — until it's set, admin access is disabled.
3. Deploy. You'll get a temporary `*.vercel.app` URL to test.

## 3. Custom domain (worldcup.kachwalas.com)

1. In Vercel: **Project → Settings → Domains → Add** `worldcup.kachwalas.com`.
   Vercel will show the DNS record it expects (a CNAME to `cname.vercel-dns.com`).
2. In **Squarespace**: **Settings → Domains →** select `kachwalas.com` **→ DNS
   Settings → Add a custom record**:
   - **Type:** `CNAME`
   - **Host:** `worldcup`
   - **Data:** `cname.vercel-dns.com`
3. Wait for DNS to propagate (usually minutes). Vercel issues HTTPS automatically.

## 4. Live-score poller (free)

Scores come from **football-data.org** (free tier — covers the 2026 World Cup,
final scores, slightly delayed; not a live in-play clock).

Vercel's free plan caps cron at **once per day**, so the poller is scheduled in
**Supabase** instead (`pg_cron`, every minute, free). The `/api/poll` endpoint is
budget-aware — it only calls football-data when a match is live and the planner's
interval (`src/lib/polling.ts`) has elapsed.

1. Set `FOOTBALL_DATA_TOKEN` (free, from football-data.org) and `CRON_SECRET` in
   Vercel and redeploy.
2. In the Supabase SQL Editor, run `supabase/cron.sql`, replacing
   `YOUR_CRON_SECRET` with the same value.
3. Verify with `select * from cron.job_run_details order by start_time desc;`.

The poller auto-confirms a result when football-data reports `FINISHED`, feeding
the leaderboards. `/admin` stays available to correct or fill anything by hand.

## Recovery

The app is stateless; all data lives in Supabase. To recompute the leaderboard
from raw predictions + confirmed results, run the recompute path
(`src/lib/recompute.ts`). See the "Durability & recovery" section in the README.
