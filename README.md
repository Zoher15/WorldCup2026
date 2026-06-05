# World Cup 2026 Prediction Game

A friction-free game where family and friends predict the **scoreline** and the
**winner** of every match. Designed to be dead simple across all ages: join a
group with a short code and a name, tap your predictions, watch the leaderboard.

## Scoring

Every match prediction is worth up to **10 points**, made of two independent
parts that always add up to the total:

### 1. Outcome points — did you back the right direction?

| Your call vs reality | Points |
| --- | --- |
| Right winner, or right draw | **6** |
| One step off (you said draw, someone won — or vice-versa) | **3** |
| Backed the wrong team entirely | **0** |

Picking the **wrong team** costs you 6, while predicting a **draw** only costs
3 — so a wrong winner is punished twice as hard as a draw.

### 2. Closeness points — how close was the scoreline?

```
closeness = max(0, 4 − totalGoalError)
totalGoalError = |predHome − actualHome| + |predAway − actualAway|
```

Over-/under-shooting the goal count bleeds points smoothly, so when the real
score is 5–0: a guess of 5–0 → 10, 6–0 → 9, 7–0 → 8, 10–0 → 6.

### Worked example — actual result **0–1** (away win)

| Prediction | Outcome | Closeness | Total |
| --- | --- | --- | --- |
| 0–1 | 6 | 4 | **10** |
| 0–2 | 6 | 3 | **9** (right direction rewarded) |
| 0–0 | 3 | 3 | **6** (predicted a draw) |
| 1–0 | 0 | 2 | **2** (wrong winner, punished hardest) |

### Three leaderboards for free

Because the two parts are independent and additive:

- **Win predictor** = sum of outcome points
- **Scoreline predictor** = sum of closeness points
- **Overall champion** = sum of totals

## Identity & groups

- **Predict once, counts everywhere.** A prediction belongs to the person, not
  the group — `predictions` is keyed on `(user_id, match_id)` and reused across
  every group you're in. No re-entering the same score, and no hedging.
- **Lightweight identity.** Stored on your device, with an optional short
  recovery code to reclaim it on a new device. No passwords.
- **Real name vs display name.** Your **real name** lives on your account and
  stays consistent across every group. Your **display name** is a fun alias you
  pick per group ("GoalMachine" with friends, "Dad" in the family group) and is
  what shows on that group's leaderboard.
- **Late joiners** are handled per group via `late_join_policy`
  (`carry_over` existing predictions, or `start_even` from the group's start).

## Live scores

A single server-side poller fetches live scores (API-Football free tier) and
writes them to `matches`; every browser updates via Supabase Realtime, so one
request feeds the whole family. Final results are gated by `result_confirmed`
(admin override) before points are awarded.

### Smart polling planner (`src/lib/polling.ts`)

Polling frequency is computed per day, not hard-coded:

1. **Predict the live period.** One API request returns *all* in-play matches,
   so cost is driven by the **union** of each match's expected live window —
   simultaneous matches share polls and cost the same as one. Knockout windows
   include **extra time + penalties** (worst case, since we can't know ahead and
   must catch the real finish).
2. **Derive the frequency.** From that period and the day's budget, pick the
   fastest interval that still fits — never exceeding the quota (which would lock
   us out mid-match). Days are bucketed by **UTC** to match the quota reset.

On the free tier this yields ~90s refresh on single/simultaneous-match days and
automatically stretches the interval on busy spread-out days (flagged
`degraded`) — bump `dailyBudget` for a paid month and fast polling returns.

## Visual design

Aim: **festive and colorful**, fun for all ages, friction-free on phones.

- **Crisp SVG flags** for every team (via a flag library + a FIFA→ISO code map,
  since FIFA codes like `GER`/`NED` differ from ISO `DE`/`NL`). Knockout
  placeholders ("Winner Group A") get a neutral icon until the team is known.
- **Match cards**: both flags, team names/codes, kickoff in the viewer's local
  time, venue, and an animated live pill (`LIVE 67'`, `HT`, `FT`, `ET`, `PENS`).
  Your prediction and the +/− steppers sit on the card and lock at kickoff.
- **Leaderboard graphic**: a top-3 podium (gold/silver/bronze), ranked rows with
  flag/avatar + display name + points + live movement arrows (▲▼), and three
  tabs — Overall · Win predictor · Scoreline predictor. Points animate as live
  results come in.

## Durability & recovery

Predictions are never lost, and the leaderboard can always be rebuilt:

- **Predictions are the source of truth**, stored in Postgres (Supabase). The
  app itself is stateless, so relaunching, redeploying, or resetting the website
  changes nothing — the data lives in the database, not the app.
- **Everything else is derived.** Points and standings are computed from raw
  predictions + confirmed results by a pure function, so the cached
  `match_scores` can be thrown away and **recomputed from scratch** at any time
  (`src/lib/recompute.ts`) — deterministically and idempotently.
- **Recompute triggers**: correcting a wrong result, a code change to scoring,
  or any doubt about the cache. Same inputs always produce the same scores.
- **Backups**: Supabase takes automatic daily backups (point-in-time recovery on
  paid tiers); a periodic export of `predictions` is a cheap extra safety net.

## Project status

- ✅ Scoring engine + tests (`src/lib/scoring.ts`)
- ✅ Database schema (`supabase/migrations/0001_init.sql`) + domain types
- ⬜ Seed the 104 World Cup 2026 fixtures
- ⬜ Join flow (group code + name)
- ⬜ Prediction UI (locks at kickoff)
- ✅ Smart polling planner + tests (`src/lib/polling.ts`)
- ✅ Recompute / recovery engine + tests (`src/lib/recompute.ts`)
- ⬜ Results entry + live sync (driven by the planner) + scoring run
- ⬜ Leaderboards (overall / win / scoreline)
- ⬜ PWA polish

## Development

```bash
npm test   # run the scoring engine tests (Node's built-in runner, no install)
```

Planned stack: Next.js + Tailwind CSS + Supabase (Postgres) + Vercel.
