-- Add Anneso, Maria, Caio, Caroline from "feet are life" into "world cup feverrr".
--
-- Run this in the Supabase SQL Editor (it uses the service role, bypassing RLS).
-- It copies each person's user_id into the target group, reusing the display
-- name they already have in "feet are life". Idempotent: re-running is a no-op
-- (on conflict do nothing), and joined_at defaults to now() for the new group.
--
-- Group names are matched case-insensitively. If either name matches more than
-- one group, the script aborts (see the guards) so you don't write to the wrong
-- board — resolve by code instead in that case.

with src as (
  select id from groups where lower(name) = lower('feet are life')
),
dst as (
  select id from groups where lower(name) = lower('world cup feverrr')
),
-- Guard against ambiguous names: bail loudly rather than guess.
guard as (
  select
    case when (select count(*) from src) <> 1
         then 1 / 0 end,  -- forces an error if "feet are life" isn't unique
    case when (select count(*) from dst) <> 1
         then 1 / 0 end   -- forces an error if "world cup feverrr" isn't unique
)
insert into memberships (user_id, group_id, display_name, is_admin)
select m.user_id, (select id from dst), m.display_name, false
from memberships m
where m.group_id = (select id from src)
  and m.display_name in ('Anneso', 'Maria', 'Caio', 'Caroline')
on conflict (user_id, group_id) do nothing;

-- Verify who's now in "world cup feverrr":
select m.display_name, m.is_admin, m.joined_at
from memberships m
join groups g on g.id = m.group_id
where lower(g.name) = lower('world cup feverrr')
order by m.joined_at;
