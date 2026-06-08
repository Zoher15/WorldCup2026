-- Switch identity to Supabase Auth (email magic-link).
--
-- `users` becomes a profile row keyed by the Supabase Auth user id, so the
-- app's user id == auth.uid() and stays the key for memberships, predictions,
-- and groups.created_by. Safe to run as-is: there are no real users yet (only
-- the seeded `matches` have rows).

-- The id is now supplied on insert (the auth user's id), not random.
alter table users alter column id drop default;

-- Tie every profile to an auth account; deleting the account removes the row.
alter table users
  add constraint users_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;
