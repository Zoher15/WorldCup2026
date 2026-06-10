-- Track which render version produced each stored share image.
--
-- The /s/<code>/og endpoint serves stored bytes, so a change to the image
-- layout (src/lib/og-render.tsx) wouldn't otherwise reach groups whose image is
-- already cached. Stamping each stored image with OG_RENDER_VERSION lets the
-- endpoint re-render anything older than the current version on next view.
-- Existing rows default to 0, so they re-render once after this migration.

alter table group_og_images
  add column if not exists render_version integer not null default 0;
