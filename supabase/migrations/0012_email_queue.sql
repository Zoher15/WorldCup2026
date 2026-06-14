-- One queue for ALL outbound email, with a single global rate gate.
--
-- Previously sign-in codes had their own queue (login_email_queue) while the
-- reminder emails sent inline via Resend's batch endpoint, each path throttling
-- itself against a DIFFERENT idea of the limit (2/min vs 2/sec) with nothing
-- coordinating the two. A sign-in rush overlapping a match-day broadcast could
-- collectively blow Resend's real cap (2 requests/second).
--
-- Now every email — the transactional sign-in code and the per-user match-day
-- digest alike — is enqueued here and drained by ONE single-flight drainer that
-- paces requests to stay under 2 req/s. Sign-in codes are minted at SEND time
-- (so no live credential is stored — the row only holds the address + post-auth
-- destination); digest rows carry their pre-rendered subject/html. The drainer
-- batches digest rows (up to 100 per Resend request) and sends sign-in codes
-- individually, all metered by the one gate.
--
-- Additive: the old login_email_queue table is left in place so any sign-in code
-- queued at deploy time still drains (the legacy drainer keeps running through
-- the transition). It can be dropped in a later migration once it's empty.
--
-- Written only by the server (service role), so RLS denies anon access.

create table if not exists email_queue (
  id          bigint generated always as identity primary key,
  -- 'login'  → mint a one-time sign-in code at send time, one email per request.
  -- 'digest' → a pre-rendered per-user match-day email, batched up to 100/request.
  kind        text        not null,
  recipient   text        not null,
  -- Pre-rendered for 'digest'; null for 'login' (the code is minted at send).
  subject     text,
  html        text,
  -- Per-message headers (e.g. List-Unsubscribe), stored as JSON.
  headers     jsonb,
  -- Login only: the post-auth redirect baked into the sign-in link at send time.
  next        text,
  -- pending → waiting to send; sending → claimed by the drainer; sent / failed.
  status      text        not null default 'pending',
  attempts    int         not null default 0,
  created_at  timestamptz not null default now(),
  -- When the drainer claimed the row (status = 'sending'); used to reclaim rows
  -- orphaned by a crash mid-send.
  claimed_at  timestamptz,
  sent_at     timestamptz
);

-- The drainer's hot path: oldest pending rows first.
create index if not exists email_queue_pending_idx
  on email_queue (created_at)
  where status = 'pending';

-- Status/ETA lookups for a specific sign-in row.
create index if not exists email_queue_login_pending_idx
  on email_queue (id)
  where status = 'pending' and kind = 'login';

alter table email_queue enable row level security;

-- Single-flight lock so only ONE drainer runs at a time, anywhere. With at most
-- one drainer active, its in-process request spacing is globally authoritative —
-- the simplest way to guarantee we never exceed Resend's 2 req/s. A stale lock
-- (drainer crashed mid-drain) is reclaimed after a TTL by the next drainer.
create table if not exists email_drain_lock (
  id        int primary key,
  locked_at timestamptz
);
insert into email_drain_lock (id, locked_at)
  values (1, null)
  on conflict (id) do nothing;

alter table email_drain_lock enable row level security;
