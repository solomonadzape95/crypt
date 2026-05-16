export type VaultStatus =
  | "funding"
  | "locked"
  | "under_threat"
  | "disbursed"
  | "expired";

export type DisputeStatus =
  | "none"
  | "pending"
  | "in_review"
  | "resolved_provider"
  | "resolved_subscriber";

export type CheckSignal = "healthy" | "error" | "timeout" | "manual_kill";

export type EscrowSide = "guarantee" | "subscription";

export type PayoutMode = "per_vault" | "pool";

export type PeriodOption = { days: number; multiplier: number };

export type Listing = {
  id: string;
  provider_wallet: string;
  provider_payout_target: string;
  title: string;
  description: string | null;
  api_url: string;
  oracle_period_sec: number;
  failure_threshold: number;
  sla_target_pct: number;
  guarantee_usdc: number;
  subscription_fee_usdc: number;
  period_options: PeriodOption[];
  expect_body_regex: string | null;
  payout_mode: PayoutMode;
  pool_amount_usdc: number | null;
  pool_contract_id: string | null;
  coverage_ratio_x: number | null;
  pool_funded_at: string | null;
  pool_payout_target: string | null;
  pool_error: string | null;
  active: boolean;
  created_at: string;
};

export type Vault = {
  id: string;
  listing_id: string | null;
  provider_wallet: string;
  subscriber_wallet: string;
  provider_payout_target: string | null;
  subscriber_payout_target: string | null;
  api_url: string;

  guarantee_usdc: number;
  guarantee_escrow_contract_id: string | null;
  guarantee_fund_tx_hash: string | null;
  guarantee_funded_at: string | null;
  guarantee_payout_tx_hash: string | null;

  subscription_fee_usdc: number;
  subscription_escrow_contract_id: string | null;
  subscription_fund_tx_hash: string | null;
  subscription_funded_at: string | null;
  subscription_payout_tx_hash: string | null;

  oracle_period_sec: number;
  status: VaultStatus;
  consecutive_failures: number;
  consecutive_successes: number;
  failure_threshold: number;
  sla_target_pct: number;
  kill_active: boolean;
  settle_error: string | null;
  expect_body_regex: string | null;

  period_days: number | null;
  expires_at: string | null;
  funding_expires_at: string | null;

  // Pool-mode vaults only.
  claim_amount_usdc: number | null;
  pool_contract_snapshot: string | null;

  dispute_status: DisputeStatus;
  dispute_window_ends_at: string | null;
  dispute_evidence: string | null;
  dispute_opened_at: string | null;
  dispute_resolved_by: string | null;
  dispute_resolved_at: string | null;

  triggered_at: string | null;
  created_at: string;
};

export type CheckRow = {
  id: number;
  vault_id: string;
  ts: string;
  signal: CheckSignal;
  status_code: number | null;
  response_ms: number | null;
};
