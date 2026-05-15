/**
 * TW skims a protocol commission off every escrow. Pad the funded amount by
 * this rate so the on-chain balance — what resolve-dispute can distribute —
 * equals the net amount the subscriber/provider was quoted in the UI.
 *
 * Pure constants only — safe to import from client components. The server
 * TW REST wrapper re-exports these for use in deploy / fund / settle calls.
 */
// TW protocol fee per https://www.trustlesswork.com/pricing — 0.3% flat,
// applied at release. We pad the funded amount by this rate so the
// receivable balance ≈ the net amount the subscriber/provider was quoted.
// (Exact distribution still comes from the runtime balance lookup to
// avoid 4dp rounding mismatches in resolve-dispute.)
export const TW_COMMISSION_RATE = 0.003;

/** Net → gross. Ceil to 4dp so rounding never leaves the balance one cent short. */
export function grossWithTwFee(netUsdc: number): number {
  return Math.ceil((netUsdc / (1 - TW_COMMISSION_RATE)) * 1e4) / 1e4;
}
