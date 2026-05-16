import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { readSession } from "@/lib/wallet-session";
import { settleVault } from "@/lib/payout";
import type { CheckSignal, Vault } from "@/lib/types";

const TIMEOUT_MS = 5000;
const RECOVER_THRESHOLD = 2; // consecutive successes required to clear failures (#5)
// Provider has N seconds to challenge a breach before auto-payout. Override
// via DISPUTE_WINDOW_SEC env var (useful for demos — set to 30 to compress
// the 5-min default).
const DISPUTE_WINDOW_MS = Math.max(
  10_000,
  Number(process.env.DISPUTE_WINDOW_SEC ?? 30) * 1000,
);
const MAX_BODY_BYTES = 64 * 1024; // cap body reads when validating regex

/**
 * Oracle tick: ping the vault's api_url, log a check row, advance vault state.
 *
 * Settlement is no longer triggered here. Once the failure threshold is hit
 * we open a 5-minute dispute window (`dispute_status='pending'`); the cron
 * sweep at /api/cron/sweep settles disbursements after the window closes (or
 * on admin resolution from the /admin/disputes UI).
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
  // Dispute lifecycle:
  //   - in_review / resolved_*  → admin or cron drives. Nothing to do.
  //   - pending + window expired → cron normally settles. Do it here too so
  //     the demo flow works locally without Vercel Cron — the page is
  //     already ticking the oracle at oracle_period_sec, no extra wiring
  //     needed. Idempotent via the same atomic claim the cron uses.
  //   - pending + window still open → bail; UI shows DisputePanel countdown.
  if (vault.dispute_status === "pending") {
    if (
      vault.dispute_window_ends_at &&
      new Date(vault.dispute_window_ends_at) < new Date()
    ) {
      return await settleExpiredDispute(svc, vault as Vault);
    }
    return NextResponse.json({
      skipped: true,
      status: vault.status,
      dispute_status: vault.dispute_status,
    });
  }
  if (vault.dispute_status !== "none") {
    return NextResponse.json({
      skipped: true,
      status: vault.status,
      dispute_status: vault.dispute_status,
    });
  }

  const alreadyBreached = vault.consecutive_failures >= vault.failure_threshold;

  let signal: CheckSignal = "healthy";
  let statusCode: number | null = null;
  let responseMs: number | null = null;
  let bodyMismatch = false;

  if (!alreadyBreached) {
    if (vault.kill_active) {
      signal = "manual_kill";
    } else {
      const started = Date.now();
      try {
        const res = await fetch(vault.api_url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        responseMs = Date.now() - started;
        statusCode = res.status;
        if (!res.ok) {
          signal = "error";
        } else if (vault.expect_body_regex) {
          // Body validation (#4): status 200 alone isn't enough when the
          // provider explicitly requested body matching.
          const text = await readCappedBody(res);
          try {
            const re = new RegExp(vault.expect_body_regex);
            if (re.test(text)) {
              signal = "healthy";
            } else {
              signal = "error";
              bodyMismatch = true;
            }
          } catch {
            // The regex was invalid at insert time we'd have rejected it,
            // but defend in depth: log + treat as healthy so a bad regex
            // doesn't silently grief the provider.
            console.warn(
              `[vault/check] vault ${id} has unparseable expect_body_regex; ignoring`,
            );
            signal = "healthy";
          }
        } else {
          signal = "healthy";
        }
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
    signal = vault.kill_active ? "manual_kill" : "timeout";
  }

  const isFailure = signal !== "healthy";

  // ── Hysteresis (#5) ──────────────────────────────────────────────────────
  // A single fluke 200 can no longer reset the failure counter. Require N
  // consecutive successes before we declare the API recovered. Failures
  // reset the success streak immediately.
  let nextFailures: number;
  let nextSuccesses: number;
  if (isFailure) {
    nextFailures = Math.min(vault.consecutive_failures + 1, vault.failure_threshold);
    nextSuccesses = 0;
  } else {
    nextSuccesses = vault.consecutive_successes + 1;
    nextFailures =
      nextSuccesses >= RECOVER_THRESHOLD ? 0 : vault.consecutive_failures;
    if (nextSuccesses >= RECOVER_THRESHOLD) nextSuccesses = 0;
  }

  if (!isFailure) {
    await svc
      .from("vaults")
      .update({
        consecutive_failures: nextFailures,
        consecutive_successes: nextSuccesses,
        status: "locked",
      })
      .eq("id", id);
    return NextResponse.json({
      signal,
      statusCode,
      responseMs,
      consecutiveFailures: nextFailures,
      consecutiveSuccesses: nextSuccesses,
      status: "locked",
    });
  }

  // Below threshold — just log progress.
  if (nextFailures < vault.failure_threshold) {
    await svc
      .from("vaults")
      .update({
        consecutive_failures: nextFailures,
        consecutive_successes: 0,
        status: "under_threat",
      })
      .eq("id", id);
    return NextResponse.json({
      signal,
      statusCode,
      responseMs,
      consecutiveFailures: nextFailures,
      consecutiveSuccesses: 0,
      status: "under_threat",
      bodyMismatch,
    });
  }

  // ── Threshold breached → open the dispute window. Atomic claim (#2) ──────
  // Conditional UPDATE so two concurrent ticks can't both flip to 'pending'.
  // Only the writer that actually toggles dispute_status: 'none' → 'pending'
  // proceeds; second tick sees zero rows updated and bails.
  const claimedAt = new Date();
  const windowEndsAt = new Date(claimedAt.getTime() + DISPUTE_WINDOW_MS);
  const { data: claimed, error: claimErr } = await svc
    .from("vaults")
    .update({
      consecutive_failures: nextFailures,
      consecutive_successes: 0,
      status: "under_threat",
      dispute_status: "pending",
      dispute_window_ends_at: windowEndsAt.toISOString(),
      triggered_at: claimedAt.toISOString(),
      settle_error: null,
    })
    .eq("id", id)
    .eq("dispute_status", "none")
    .in("status", ["locked", "under_threat"])
    .select("id");
  if (claimErr) {
    return NextResponse.json({ error: claimErr.message }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    // Race lost or vault moved past a settle-able state. Either way: nothing
    // to do.
    return NextResponse.json({
      signal,
      statusCode,
      responseMs,
      consecutiveFailures: nextFailures,
      status: vault.status,
      debounced: true,
    });
  }

  return NextResponse.json({
    signal,
    statusCode,
    responseMs,
    consecutiveFailures: nextFailures,
    status: "under_threat",
    dispute_status: "pending",
    dispute_window_ends_at: windowEndsAt.toISOString(),
  });
}

async function settleExpiredDispute(
  svc: ReturnType<typeof getServiceClient>,
  vault: Vault,
) {
  // Atomic claim — pending → resolved_subscriber. Mirrors the cron sweep.
  const { data: claimed } = await svc
    .from("vaults")
    .update({
      dispute_status: "resolved_subscriber",
      dispute_resolved_by: "oracle-tick",
      dispute_resolved_at: new Date().toISOString(),
    })
    .eq("id", vault.id)
    .eq("dispute_status", "pending")
    .select("id");
  if (!claimed || claimed.length === 0) {
    // Cron beat us, or someone resolved it manually. Nothing to do.
    return NextResponse.json({ skipped: true, status: vault.status });
  }
  try {
    const settled = await settleVault(vault, "breach");
    await svc
      .from("vaults")
      .update({
        status: "disbursed",
        guarantee_payout_tx_hash: settled.guaranteeTxHash,
        subscription_payout_tx_hash: settled.subscriptionTxHash,
        settle_error: null,
      })
      .eq("id", vault.id);
    return NextResponse.json({
      status: "disbursed",
      guaranteePayoutTxHash: settled.guaranteeTxHash,
      subscriptionPayoutTxHash: settled.subscriptionTxHash,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "settle failed";
    console.error("[vault/check] expired-window settle failed", e);
    await svc
      .from("vaults")
      .update({ settle_error: msg.slice(0, 500) })
      .eq("id", vault.id);
    return NextResponse.json(
      { status: vault.status, settleError: msg },
      { status: 200 },
    );
  }
}

async function readCappedBody(res: Response): Promise<string> {
  // We don't trust upstream Content-Length; cap on the read.
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      const remaining = MAX_BODY_BYTES - total;
      chunks.push(value.byteLength > remaining ? value.slice(0, remaining) : value);
      total += value.byteLength;
    }
  }
  reader.cancel().catch(() => {});
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    merged.set(c.slice(0, Math.min(c.byteLength, total - off)), off);
    off += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}
