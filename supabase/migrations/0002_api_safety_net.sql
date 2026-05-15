-- API Safety Net — pivot from Tilt.
-- Drops the Tilt session/pool/heartbeat domain and creates vaults + oracle checks.

-- ──────────────────────────────────────────────────────────────────────────
-- drop Tilt tables / types (safe to re-run)
-- ──────────────────────────────────────────────────────────────────────────

drop table if exists public.flows      cascade;
drop table if exists public.heartbeats cascade;
drop table if exists public.milestones cascade;
drop table if exists public.sessions   cascade;
drop table if exists public.wallets    cascade;
drop table if exists public.queue      cascade;

drop type if exists tilt_signal          cascade;
drop type if exists tilt_session_status  cascade;
drop type if exists tilt_role            cascade;
drop type if exists tilt_milestone_kind  cascade;

-- ──────────────────────────────────────────────────────────────────────────
-- Vault domain (idempotent reset)
-- ──────────────────────────────────────────────────────────────────────────

drop table if exists public.checks cascade;
drop table if exists public.vaults cascade;
drop type  if exists vault_status  cascade;
drop type  if exists check_signal  cascade;

create extension if not exists "pgcrypto";

create type vault_status as enum (
  'funding',
  'locked',
  'under_threat',
  'disbursed',
  'expired'
);

create type check_signal as enum (
  'healthy',
  'error',
  'timeout',
  'manual_kill'
);

create table public.vaults (
  id                  uuid primary key default gen_random_uuid(),
  provider_wallet     text not null,
  subscriber_wallet   text not null,
  api_url             text not null,
  guarantee_usdc      numeric(10, 2) not null,
  escrow_contract_id  text,
  fund_tx_hash        text,
  status              vault_status not null default 'funding',
  consecutive_failures int not null default 0,
  failure_threshold   int not null default 3,
  sla_target_pct      numeric(5, 2) not null default 99.9,
  kill_active         boolean not null default false,
  boundless_url       text,
  payout_tx_hash      text,
  created_at          timestamptz not null default now(),
  funded_at           timestamptz,
  triggered_at        timestamptz
);

create index vaults_provider_idx on public.vaults (provider_wallet);
create index vaults_status_idx   on public.vaults (status);

create table public.checks (
  id          bigserial primary key,
  vault_id    uuid not null references public.vaults(id) on delete cascade,
  ts          timestamptz not null default now(),
  signal      check_signal not null,
  status_code int,
  response_ms int
);

create index checks_vault_ts_idx on public.checks (vault_id, ts desc);

-- ──────────────────────────────────────────────────────────────────────────
-- realtime publications
-- ──────────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.vaults;
alter publication supabase_realtime add table public.checks;

-- RLS intentionally disabled — writes go through API routes that validate the
-- signed `tilt_session` cookie; reads via anon are public (acceptable for v1).
