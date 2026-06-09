-- India vs Italy practice ("trial") match.
--
-- A flagged warm-up so players can learn the flow before the tournament. Its
-- result is baked in (India 2-1 Italy) and confirmed, so a prediction is scored
-- immediately and feeds a pre-tournament leaderboard. It stays open to edit
-- until just before the World Cup's first kickoff, then locks and stops
-- counting (see TOURNAMENT_START in src/lib/prediction-rules.ts).

alter table matches add column if not exists is_trial boolean not null default false;

insert into matches (
  external_ref, stage, home_team, away_team, home_code, away_code,
  kickoff_at, status, home_goals, away_goals, result_confirmed, is_trial
)
values (
  'trial-ind-ita', 'group', 'India', 'Italy', 'IND', 'ITA',
  '2026-06-11T18:00:00.000Z', 'finished', 2, 1, true, true
)
on conflict (external_ref) do nothing;
