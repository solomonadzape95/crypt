-- 0006 — provider pool payout mode.
-- Per-vault listings keep working as before. New listings can opt into a
-- shared "pool" escrow that pays out across many subscribers' breaches.

do $$ begin
  create type payout_mode as enum ('per_vault', 'pool');
exception when duplicate_object then null;
end $$;

alter table listings
  add column if not exists payout_mode payout_mode not null default 'per_vault',
  add column if not exists pool_amount_usdc numeric(12,2),
  add column if not exists pool_contract_id text,
  add column if not exists coverage_ratio_x numeric(6,2) default 10,
  add column if not exists pool_funded_at timestamptz,
  add column if not exists pool_payout_target text,  -- where the residual goes if the listing is ever closed
  add column if not exists pool_error text;          -- surfaces a re-deploy failure for admin recovery

alter table vaults
  add column if not exists claim_amount_usdc numeric(12,2),    -- pool vaults only — per-breach payout
  add column if not exists pool_contract_snapshot text;        -- audit trail: which pool was active at subscribe time

create index if not exists listings_payout_mode_idx on listings (payout_mode, active);
create index if not exists vaults_pool_listing_idx on vaults (listing_id) where claim_amount_usdc is not null;
