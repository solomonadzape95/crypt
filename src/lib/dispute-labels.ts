import type { DisputeStatus } from "./types";

/** Human-readable label for each dispute_status enum value. */
export const DISPUTE_LABELS: Record<DisputeStatus, string> = {
  none: "no dispute",
  pending: "challenge window open",
  in_review: "under admin review",
  resolved_provider: "ruled for provider",
  resolved_subscriber: "ruled for subscriber",
};

export function disputeLabel(s: DisputeStatus): string {
  return DISPUTE_LABELS[s] ?? s;
}
