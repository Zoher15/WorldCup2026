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

## Project status

- ✅ Scoring engine + tests (`src/lib/scoring.ts`)
- ⬜ Database schema + 2026 fixtures
- ⬜ Join flow (group code + name)
- ⬜ Prediction UI (locks at kickoff)
- ⬜ Results entry + scoring run
- ⬜ Leaderboards
- ⬜ PWA polish

## Development

```bash
npm test   # run the scoring engine tests (Node's built-in runner, no install)
```

Planned stack: Next.js + Tailwind CSS + Supabase (Postgres) + Vercel.
