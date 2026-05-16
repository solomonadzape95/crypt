import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { refundOneSide, settleVault } from "@/lib/payout";
import type { Vault } from "@/lib/types";

/**
 * Cron sweep — fires every minute via Vercel Cron (see web/vercel.json).
 * Three independent sweeps; each is wrapped so one failure can't kill the
 * others. Local invocation:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        http://localhost:3000/api/cron/sweep
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const got = req.headers.get("authorization");
  if (got !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const svc = getServiceClient();
  const summary = {
    disputeSettled: 0,
    cleanExpired: 0,
    fundingRefunded: 0,
    fundingExpiredEmpty: 0,
    errors: [] as string[],
  };

  // (a) Dispute window expired without a challenge → settle to subscriber.
  try {
    const { data: pending } = await svc
      .from("vaults")
      .select("*")
      .eq("dispute_status", "pending")
      .lt("dispute_window_ends_at", new Date().toISOString())
      .limit(20);
    for (const v of (pending ?? []) as Vault[]) {
      try {
        // Atomic claim — only one cron tick can flip pending → resolved.
        const { data: claimed } = await svc
          .from("vaults")
          .update({
            dispute_status: "resolved_subscriber",
            dispute_resolved_by: "cron",
            dispute_resolved_at: new Date().toISOString(),
          })
          .eq("id", v.id)
          .eq("dispute_status", "pending")
          .select("id");
        if (!claimed || claimed.length === 0) continue;
        const settled = await settleVault(v, "breach");
        await svc
          .from("vaults")
          .update({
            status: "disbursed",
            guarantee_payout_tx_hash: settled.guaranteeTxHash,
            subscription_payout_tx_hash: settled.subscriptionTxHash,
            settle_error: null,
          })
          .eq("id", v.id);
        summary.disputeSettled++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "settle failed";
        await svc.from("vaults").update({ settle_error: msg.slice(0, 500) }).eq("id", v.id);
        summary.errors.push(`dispute ${v.id}: ${msg}`);
      }
    }
  } catch (e) {
    summary.errors.push(`dispute sweep: ${err(e)}`);
  }

  // (b) Coverage period expired clean → settle to provider.
  try {
    const { data: cleanRows } = await svc
      .from("vaults")
      .select("*")
      .eq("status", "locked")
      .eq("dispute_status", "none")
      .lt("expires_at", new Date().toISOString())
      .limit(20);
    for (const v of (cleanRows ?? []) as Vault[]) {
      try {
        // Atomic claim so two ticks can't both settle the same vault.
        const { data: claimed } = await svc
          .from("vaults")
          .update({ status: "expired" }) // intermediate flag — flipped to disbursed below on success
          .eq("id", v.id)
          .eq("status", "locked")
          .eq("dispute_status", "none")
          .select("id");
        if (!claimed || claimed.length === 0) continue;
        const settled = await settleVault(v, "clean");
        await svc
          .from("vaults")
          .update({
            status: "disbursed",
            guarantee_payout_tx_hash: settled.guaranteeTxHash,
            subscription_payout_tx_hash: settled.subscriptionTxHash,
            settle_error: null,
          })
          .eq("id", v.id);
        summary.cleanExpired++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "clean settle failed";
        // Roll back the intermediate "expired" so a retry can pick it up.
        await svc
          .from("vaults")
          .update({ status: "locked", settle_error: msg.slice(0, 500) })
          .eq("id", v.id);
        summary.errors.push(`clean ${v.id}: ${msg}`);
      }
    }
  } catch (e) {
    summary.errors.push(`clean sweep: ${err(e)}`);
  }

  // (c) Funding TTL expired — refund the funded side, expire vault.
  try {
    const { data: fundingRows } = await svc
      .from("vaults")
      .select("*")
      .eq("status", "funding")
      .lt("funding_expires_at", new Date().toISOString())
      .limit(20);
    for (const v of (fundingRows ?? []) as Vault[]) {
      try {
        const providerFunded = !!v.guarantee_funded_at;
        const subscriberFunded = !!v.subscription_funded_at;

        if (!providerFunded && !subscriberFunded) {
          // Nothing on chain — just mark expired. Atomic claim so we don't
          // double-touch.
          const { data: claimed } = await svc
            .from("vaults")
            .update({ status: "expired" })
            .eq("id", v.id)
            .eq("status", "funding")
            .select("id");
          if (claimed && claimed.length > 0) summary.fundingExpiredEmpty++;
          continue;
        }

        // Atomic claim before any TW call so a retry doesn't double-refund.
        const { data: claimed } = await svc
          .from("vaults")
          .update({ status: "expired" })
          .eq("id", v.id)
          .eq("status", "funding")
          .select("id");
        if (!claimed || claimed.length === 0) continue;

        // Pool-backed vaults share the listing's pool escrow — we never
        // "refund" that to the provider on funding-TTL expiry; the pool
        // stays funded for other subscribers. Skip the guarantee leg.
        const isPoolVault = v.claim_amount_usdc != null;
        if (providerFunded && !isPoolVault && v.guarantee_escrow_contract_id) {
          const tx = await refundOneSide({
            contractId: v.guarantee_escrow_contract_id,
            depositor: v.provider_payout_target ?? v.provider_wallet,
          });
          await svc
            .from("vaults")
            .update({ guarantee_payout_tx_hash: tx ?? v.guarantee_payout_tx_hash })
            .eq("id", v.id);
        }
        if (subscriberFunded && v.subscription_escrow_contract_id) {
          const tx = await refundOneSide({
            contractId: v.subscription_escrow_contract_id,
            depositor: v.subscriber_payout_target ?? v.subscriber_wallet,
          });
          await svc
            .from("vaults")
            .update({ subscription_payout_tx_hash: tx ?? v.subscription_payout_tx_hash })
            .eq("id", v.id);
        }
        summary.fundingRefunded++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "refund failed";
        // Roll back so a retry can attempt again.
        await svc
          .from("vaults")
          .update({ status: "funding", settle_error: msg.slice(0, 500) })
          .eq("id", v.id);
        summary.errors.push(`funding ${v.id}: ${msg}`);
      }
    }
  } catch (e) {
    summary.errors.push(`funding sweep: ${err(e)}`);
  }

  return NextResponse.json(summary);
}

function err(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
