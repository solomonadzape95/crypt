-- tilt — v3 schema (wallet-only auth, no Supabase Auth dependency)
-- Stellar testnet only for v1. Identity = signed Stellar wallet address.
-- Service-role bypasses RLS; RLS is disabled because auth.uid() is not available.

-- ──────────────────────────────────────────────────────────────────────────
-- reset (safe to re-run in a fresh dev DB)
-- ──────────────────────────────────────────────────────────────────────────

drop table if exists public.flows cascade;
drop table if exists public.heartbeats cascade;
drop table if exists public.milestones cascade;
drop table if exists public.sessions cascade;
drop table if exists public.wallets cascade;
drop table if exists public.queue cascade;

drop type if exists tilt_signal cascade;
drop type if exists tilt_session_status cascade;
drop type if exists tilt_role cascade;
drop type if exists tilt_milestone_kind cascade;

create extension if not exists "pgtilto";

-- ──────────────────────────────────────────────────────────────────────────
-- enums
-- ──────────────────────────────────────────────────────────────────────────

create type tilt_signal         as enum ('working', 'scrolling', 'idle');
create type tilt_session_status as enum ('funding', 'active', 'ended', 'cancelled');

-- ──────────────────────────────────────────────────────────────────────────
-- sessions — one per active participant, keyed by wallet address
-- ──────────────────────────────────────────────────────────────────────────

create table public.sessions (
  id                  uuid primary key default gen_random_uuid(),
  wallet_address      text not null,
  stake_usdc          numeric(10, 2) not null,
  duration_sec        int not null,
  work_apps           text[] not null default '{}',
  distraction_apps    text[] not null default '{}',
  escrow_contract_id  text,
  fund_tx_hash        text,
  status              tilt_session_status not null default 'funding',
  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  ended_at            timestamptz
);

create index sessions_wallet_idx on public.sessions (wallet_address);
create index sessions_status_idx on public.sessions (status);

-- ──────────────────────────────────────────────────────────────────────────
-- milestones — pre-allocated slots per session
-- ──────────────────────────────────────────────────────────────────────────

create table public.milestones (
  session_id   uuid not null references public.sessions(id) on delete cascade,
  idx          int  not null,
  amount_usdc  numeric(10, 6) not null,
  released_at  timestamptz,
  tx_hash      text,
  primary key (session_id, idx)
);

-- ──────────────────────────────────────────────────────────────────────────
-- flows — routed micro-payments
-- ──────────────────────────────────────────────────────────────────────────

create table public.flows (
  id              bigserial primary key,
  ts              timestamptz not null default now(),
  from_session_id uuid not null references public.sessions(id) on delete cascade,
  to_session_id   uuid not null references public.sessions(id) on delete cascade,
  amount_usdc     numeric(10, 6) not null,
  tx_hash         text
);

create index flows_from_idx on public.flows (from_session_id, ts desc);
create index flows_to_idx   on public.flows (to_session_id,   ts desc);

-- ──────────────────────────────────────────────────────────────────────────
-- heartbeats — owner is implied by session
-- ──────────────────────────────────────────────────────────────────────────

create table public.heartbeats (
  id          bigserial primary key,
  session_id  uuid not null references public.sessions(id) on delete cascade,
  ts          timestamptz not null default now(),
  signal      tilt_signal not null,
  app         text
);

create index heartbeats_session_ts_idx on public.heartbeats (session_id, ts desc);

-- ──────────────────────────────────────────────────────────────────────────
-- realtime publications
-- ──────────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.milestones;
alter publication supabase_realtime add table public.heartbeats;
alter publication supabase_realtime add table public.flows;

-- RLS intentionally left disabled. Writes go through API routes which check
-- the signed `tilt_session` cookie; reads via anon are public (acceptable for v1).
