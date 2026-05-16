import type { Vault, VaultStatus } from "./types";

/** UI-only superset of VaultStatus — adds a derived "settling" branch. */
export type VaultUiStatus = VaultStatus | "settling";

/** Recent-trigger window: anything more recent than this is "in flight". */
const SETTLE_FLIGHT_MS = 90_000;

/**
 * Map a vault row to the status we render. The DB only models discrete state
 * transitions ("under_threat" → "disbursed"), so the period between threshold
 * breach and on-chain confirmation reads as stagnant in the UI. This helper
 * derives a synthetic "settling" state for that window so the dashboard can
 * say "payout in flight" without us inventing a new DB column.
 */
export function vaultUiStatus(vault: Vault, now: number = Date.now()): VaultUiStatus {
  if (vault.status === "under_threat") {
    // The DisputePanel owns the UI while the dispute is alive; "settling" is
    // for the brief window after admin resolution / window expiry where the
    // on-chain settle is in flight but the row hasn't flipped to disbursed
    // yet. So suppress "settling" during pending / in_review.
    if (vault.dispute_status === "pending" || vault.dispute_status === "in_review") {
      return vault.status;
    }
    const breached = vault.consecutive_failures >= vault.failure_threshold;
    const triggeredMs = vault.triggered_at
      ? new Date(vault.triggered_at).getTime()
      : 0;
    const recent = triggeredMs > 0 && now - triggeredMs < SETTLE_FLIGHT_MS;
    if (breached && recent) return "settling";
  }
  return vault.status;
}

/** True when the oracle has stopped probing (breach already on record). */
export function oraclePaused(vault: Vault): boolean {
  if (vault.status === "disbursed" || vault.status === "expired") return true;
  return vault.consecutive_failures >= vault.failure_threshold;
}
