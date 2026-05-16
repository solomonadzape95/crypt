-- 0005 — disputes, coverage period, funding TTL, body validation, hysteresis.
-- Drops the deprecated Boundless link columns at the same time.

-- 1. Drop Boundless completely.
alter table vaults    drop column if exists boundless_url;
alter table listings  drop column if exists boundless_url;

-- 2. Coverage period: listing offers options, vault stores the chosen period
--    + computed expiry. Default options: 7d / 30d / 90d at ×1 / ×4 / ×11.
alter table listings
  add column if not exists period_options jsonb not null default
    '[{"days":7,"multiplier":1},{"days":30,"multiplier":4},{"days":90,"multiplier":11}]'::jsonb,
  add column if not exists expect_body_regex text;

alter table vaults
  add column if not exists period_days int,
  add column if not exists expires_at timestamptz,
  add column if not exists funding_expires_at timestamptz,
  add column if not exists consecutive_successes int not null default 0,
  add column if not exists expect_body_regex text;

-- 3. Disputes — a parallel lifecycle on top of vault.status.
do $$ begin
  create type dispute_status as enum
    ('none','pending','in_review','resolved_provider','resolved_subscriber');
exception
  when duplicate_object then null;
end $$;

alter table vaults
  add column if not exists dispute_status dispute_status not null default 'none',
  add column if not exists dispute_window_ends_at timestamptz,
  add column if not exists dispute_evidence text,
  add column if not exists dispute_opened_at timestamptz,
  add column if not exists dispute_resolved_by text,
  add column if not exists dispute_resolved_at timestamptz;

-- 4. Index for cron sweep predicates.
create index if not exists vaults_sweep_idx
  on vaults (status, dispute_status, dispute_window_ends_at, funding_expires_at, expires_at);
