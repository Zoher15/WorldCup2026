-- Queue sign-in code emails so a rush of sign-ins can't blow Resend's limit.
--
-- Resend caps us at a small number of sends per minute (see LOGIN_EMAIL_RATE_PER_MIN).
-- A sign-in used to mint a code and POST it to Resend inline, so N people signing
-- in at once fired N requests at the same instant — everything past the limit got
-- a 429, the short retry budget ran out, and those users saw "couldn't send your
-- code". Instead we enqueue the *intent* here (just the email + post-auth
-- destination — never the code itself, which is minted fresh at send time so no
-- live credential is ever stored) and drain the queue in FIFO order at the
-- provider's rate. The login action also tells the user roughly when their code
-- will land, computed from their position in this queue.
--
-- Written only by the server (service role), so RLS denies anon access.

create table if not exists login_email_queue (
  id          bigint generated always as identity primary key,
  email       text        not null,
  -- Post-auth redirect to bake into the sign-in link when the code is minted.
  next        text        not null default '/',
  -- pending → waiting to send; sending → claimed by a drainer; sent / failed.
  status      text        not null default 'pending',
  attempts    int         not null default 0,
  created_at  timestamptz not null default now(),
  -- When a drainer claimed the row (status = 'sending'); used to reclaim rows
  -- orphaned by a crash mid-send.
  claimed_at  timestamptz,
  sent_at     timestamptz
);

-- The drainer's hot path: oldest pending rows first.
create index if not exists login_email_queue_pending_idx
  on login_email_queue (created_at)
  where status = 'pending';

-- The per-minute rate gate counts rows sent in the last 60s.
create index if not exists login_email_queue_sent_idx
  on login_email_queue (sent_at)
  where status = 'sent';

alter table login_email_queue enable row level security;
