-- ---------------------------------------------------------------------------
-- Round-multiplier scoring.
--
-- The knockout "advance bonus" is gone; instead the whole match score (outcome
-- + closeness) is multiplied by a per-round factor (group ×1 … final ×6), so
-- the knockouts and the group stage each hold 50% of the points. See
-- src/lib/scoring.ts (SCORE_MULTIPLIER).
--
-- Consequences for the cached match_scores table:
--   - advance_points is no longer computed — drop it.
--   - total_points = (outcome + closeness) × multiplier, which can be
--     fractional (e.g. ×1.5, ×2.5), so widen it from int to numeric.
--   outcome_points / closeness_points stay int: they are reported at face
--   value (un-multiplied), powering the round-independent skill leaderboards.
-- ---------------------------------------------------------------------------

alter table match_scores drop column if exists advance_points;

alter table match_scores
  alter column total_points type numeric(7, 1);
