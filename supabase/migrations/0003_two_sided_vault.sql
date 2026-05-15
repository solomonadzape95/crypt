-- Two-sided SLA vault: Provider's guarantee on one side, Subscriber's subscription
-- fee on the other. Both escrows live in parallel; settlement routes both based on
-- the SLA outcome.

-- ──────────────────────────────────────────────────────────────────────────
-- Rename existing single-escrow columns to "guarantee_*"
-- ──────────────────────────────────────────────────────────────────────────

alter table public.vaults rename column escrow_contract_id to guarantee_escrow_contract_id;
alter table public.vaults rename column fund_tx_hash         to guarantee_fund_tx_hash;
alter table public.vaults rename column funded_at            to guarantee_funded_at;
alter table public.vaults rename column payout_tx_hash       to guarantee_payout_tx_hash;

-- ──────────────────────────────────────────────────────────────────────────
-- Subscriber side + oracle cadence
-- ──────────────────────────────────────────────────────────────────────────

alter table public.vaults
  add column if not exists subscription_fee_usdc            numeric(10, 2) not null default 0,
  add column if not exists subscription_escrow_contract_id  text,
  add column if not exists subscription_fund_tx_hash        text,
  add column if not exists subscription_funded_at           timestamptz,
  add column if not exists subscription_payout_tx_hash      text,
  add column if not exists oracle_period_sec                int not null default 60;
