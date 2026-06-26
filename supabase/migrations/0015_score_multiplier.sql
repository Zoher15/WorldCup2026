-- ---------------------------------------------------------------------------
-- Round-multiplier scoring.
--
-- The knockout "advance bonus" is gone; instead the whole match score (outcome
-- + closeness) is multiplied by a per-round integer factor (group ×1 … final
-- ×6), so the knockouts outweigh the group stage (930 points vs 720). See
-- src/lib/scoring.ts (SCORE_MULTIPLIER).
--
-- advance_points is no longer computed — drop it. total_points stays int: the
-- multipliers are whole numbers, so (outcome + closeness) × multiplier is always
-- a whole number. outcome_points / closeness_points are unchanged — they are
-- reported at face value (un-multiplied), powering the round-independent skill
-- leaderboards.
-- ---------------------------------------------------------------------------

alter table match_scores drop column if exists advance_points;
