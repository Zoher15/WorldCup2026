-- Throttle sign-in code requests.
--
-- "Resend code" calls the same action that mints a one-time code and emails it,
-- so a user mashing the button would mint a new OTP and fire an email each time,
-- burning through the email provider's send limits. This log records the last
-- time we emailed a code to each address; the login action refuses to send
-- another within a short cooldown (see src/app/login/actions.ts). Written only by
-- the server (service role), so RLS denies anon access.

create table if not exists login_code_requests (
  email        text primary key,
  last_sent_at timestamptz not null default now()
);

alter table login_code_requests enable row level security;
