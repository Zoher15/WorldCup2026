-- Content-addressed leaderboard share images.
--
-- Store a fingerprint of the inputs that produced each PNG (group name + ordered
-- standings + layout version; see ogContentHash in og-render.tsx). The /s/<code>/og
-- path recomputes the hash from live standings and re-renders only when it differs,
-- so the image self-heals on any change — a member joins, renames, or a result is
-- confirmed — without enumerating those events in code.
--
-- Until this runs, the column is absent: og-images.ts falls back to "no stored
-- hash", which simply forces a render on each origin hit (correct, just uncached),
-- the same graceful degradation used for render_version (0006).

alter table group_og_images
  add column if not exists content_hash text;
