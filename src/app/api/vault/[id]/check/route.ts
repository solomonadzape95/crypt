import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { readSession } from "@/lib/wallet-session";
import { settleVault } from "@/lib/payout";
import type { CheckSignal } from "@/lib/types";

const TIMEOUT_MS = 5000;

/**
 * Oracle tick: ping the vault's api_url (or honor the kill flag), insert a
 * `checks` row, advance vault state, and trigger settlement when the failure
 * threshold is hit. Either the Provider or the Subscriber may drive a tick.
 *
 * Status only flips to `disbursed` once both releases return on-chain hashes —
 * if settlement fails, the vault stays `under_threat` and the error is written
 * to `settle_error` for the next tick to retry.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await readSession();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const svc = getServiceClient();

  const { data: vault } = await svc.from("vaults").select("*").eq("id", id).single();
  if (!vault) return NextResponse.json({ error: "vault not found" }, { status: 404 });
  if (vault.provider_wallet !== auth.address && vault.subscriber_wallet !== auth.address) {
    return NextResponse.json({ error: "not your vault" }, { status: 403 });
  }
  if (vault.status === "disbursed" || vault.status === "expired") {
    return NextResponse.json({ skipped: true, status: vault.status });
  }
  if (vault.status === "funding") {
    return NextResponse.json({ skipped: true, reason: "vault not funded" });
  }

  // ── short-circuit: breach already happened ────────────────────────────────
  // Once consecutive_failures has hit the threshold, the API is presumed dead.
  // No point in probing it again — every subsequent tick should be focused on
  // landing the settlement, not piling up "ER"/"TO" rows in the incident log.
  // Fall straight through to the settle attempt (still debounced below).
  const alreadyBreached = vault.consecutive_failures >= vault.failure_threshold;

  let signal: CheckSignal = "healthy";
  let statusCode: number | null = null;
  let responseMs: number | null = null;

  if (!alreadyBreached) {
    if (vault.kill_active) {
      signal = "manual_kill";
    } else {
      const started = Date.now();
      try {
        const res = await fetch(vault.api_url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        responseMs = Date.now() - started;
        statusCode = res.status;
        signal = res.ok ? "healthy" : "error";
      } catch {
        responseMs = Date.now() - started;
        signal = "timeout";
      }
    }

    await svc.from("checks").insert({
      vault_id: id,
      signal,
      status_code: statusCode,
      response_ms: responseMs,
    });
  } else {
    // Mark this tick as a failure for the state machine's sake — but no DB
    // row, no fetch. The breach is already on record.
    signal = vault.kill_active ? "manual_kill" : "timeout";
  }

  const isFailure = signal !== "healthy";
  // Cap at the threshold so the dashboard never reads "8 / 3" — once we've
  // hit the breach line, additional failures don't mean anything until
  // settlement completes or the vault recovers.
  const nextFailures = isFailure
    ? Math.min(vault.consecutive_failures + 1, vault.failure_threshold)
    : 0;

  if (!isFailure) {
    await svc
      .from("vaults")
      .update({ consecutive_failures: nextFailures, status: "locked" })
      .eq("id", id);
    return NextResponse.json({
      signal,
      statusCode,
      responseMs,
      consecutiveFailures: nextFailures,
      status: "locked",
    });
  }

  if (nextFailures < vault.failure_threshold) {
    await svc
      .from("vaults")
      .update({ consecutive_failures: nextFailures, status: "under_threat" })
      .eq("id", id);
    return NextResponse.json({
      signal,
      statusCode,
      responseMs,
      consecutiveFailures: nextFailures,
      status: "under_threat",
    });
  }

  // ── atomic settle claim ────────────────────────────────────────────────
  // Concurrency: the vault page polls every oraclePeriodSec and there can be
  // multiple browsers (provider + subscriber) doing it at once. settleVault
  // takes 5–30s of round-trips; if a second tick fires while the first is
  // mid-settle, both ticks would otherwise both pass a read-then-check
  // debounce and both call resolve-dispute — the second one drains an
  // already-empty escrow and the next-day support thread is born.
  //
  // Replace the read-then-write with a CONDITIONAL UPDATE that Postgres
  // serializes for us: only succeed if no one else has claimed within the
  // 60s window AND the vault is still in a settle-able state. If the update
  // touches zero rows, this tick lost the race; back off cleanly.
  const claimedAt = new Date();
  const debounceCutoff = new Date(claimedAt.getTime() - 60_000).toISOString();
  const { data: claimed, error: claimErr } = await svc
    .from("vaults")
    .update({
      triggered_at: claimedAt.toISOString(),
      settle_error: null,
      consecutive_failures: nextFailures,
    })
    .eq("id", id)
    .in("status", ["locked", "under_threat"])
    .or(`triggered_at.is.null,triggered_at.lt.${debounceCutoff}`)
    .select("id");
  if (claimErr) {
    return NextResponse.json({ error: claimErr.message }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    // Another tick already holds the claim, OR the vault has moved past
    // settle-able status (e.g. just flipped to disbursed). Either way:
    // do nothing; if we still need a count update for this failed ping
    // it's not worth racing on.
    return NextResponse.json({
      signal,
      statusCode,
      responseMs,
      consecutiveFailures: nextFailures,
      status: vault.status,
      debounced: true,
    });
  }

  try {
    const settled = await settleVault(vault, "breach");
    if (!settled.guaranteeTxHash || !settled.subscriptionTxHash) {
      throw new Error(
        `settlement returned null tx hash (guarantee=${settled.guaranteeTxHash}, subscription=${settled.subscriptionTxHash})`
      );
    }
    await svc
      .from("vaults")
      .update({
        status: "disbursed",
        guarantee_payout_tx_hash: settled.guaranteeTxHash,
        subscription_payout_tx_hash: settled.subscriptionTxHash,
        settle_error: null,
      })
      .eq("id", id);
    return NextResponse.json({
      signal,
      statusCode,
      responseMs,
      consecutiveFailures: nextFailures,
      status: "disbursed",
      guaranteePayoutTxHash: settled.guaranteeTxHash,
      subscriptionPayoutTxHash: settled.subscriptionTxHash,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "settlement failed";
    console.error("[vault/check] settleVault failed", e);
    await svc
      .from("vaults")
      .update({
        status: "under_threat",
        settle_error: msg.slice(0, 500),
      })
      .eq("id", id);
    return NextResponse.json(
      {
        signal,
        statusCode,
        responseMs,
        consecutiveFailures: nextFailures,
        status: "under_threat",
        settleError: msg,
      },
      { status: 200 }
    );
  }
}
