-- Pre-rendered leaderboard share images.
--
-- Each group's OpenGraph share image (the podium PNG) is rendered server-side
-- on the Node runtime — during the live-score poll when a result is confirmed,
-- and when the group is created — then stored here. The public /s/<code>/og
-- endpoint just returns these stored bytes, so a link preview never depends on
-- rendering at request time (which is what kept blanking on the edge runtime).
--
-- Stored as base64 text rather than bytea: PostgREST round-trips text cleanly,
-- and the images are small (tens of KB) for the handful of groups in a pool.

create table if not exists group_og_images (
  group_id   uuid primary key references groups(id) on delete cascade,
  png_base64 text not null,
  updated_at timestamptz not null default now()
);
