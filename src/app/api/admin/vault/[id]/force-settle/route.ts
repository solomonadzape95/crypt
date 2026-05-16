import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-auth";
import { settleVault } from "@/lib/payout";

/**
 * Force-settle a vault to a chosen winner without going through the dispute
 * window. Admin-only — for prod testing the pool flow end-to-end without
 * waiting on oracle ticks + dispute timers.
 *
 *   POST /api/admin/vault/<id>/force-settle?winner=subscriber
 *   POST /api/admin/vault/<id>/force-settle?winner=provider
 *
 * Routes through the same `settleVault` dispatcher production uses, so this
 * exercises the real pool re-deploy path. Updates the vault row + listing
 * exactly like a normal settle would.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const { id } = await ctx.params;
  const winnerParam = new URL(req.url).searchParams.get("winner");
  if (winnerParam !== "subscriber" && winnerParam !== "provider") {
    return NextResponse.json(
      { error: "winner query param must be 'subscriber' or 'provider'" },
      { status: 400 },
    );
  }
  const outcome = winnerParam === "subscriber" ? "breach" : "clean";

  const svc = getServiceClient();
  const { data: vault } = await svc
    .from("vaults")
    .select("*")
    .eq("id", id)
    .single();
  if (!vault) return NextResponse.json({ error: "vault not found" }, { status: 404 });
  if (vault.status === "disbursed" || vault.status === "expired") {
    return NextResponse.json(
      { error: `vault is already ${vault.status}` },
      { status: 409 },
    );
  }
  if (vault.status === "funding") {
    return NextResponse.json(
      { error: "vault is still in funding state — both sides must be funded first" },
      { status: 409 },
    );
  }

  // Atomic claim — flip status so a parallel oracle tick can't double-settle.
  const claimedAt = new Date().toISOString();
  const { data: claimed } = await svc
    .from("vaults")
    .update({
      dispute_status:
        winnerParam === "subscriber" ? "resolved_subscriber" : "resolved_provider",
      dispute_resolved_by: `admin:${auth.address}`,
      dispute_resolved_at: claimedAt,
      triggered_at: claimedAt,
    })
    .eq("id", id)
    .in("status", ["locked", "under_threat"])
    .select("id");
  if (!claimed || claimed.length === 0) {
    return NextResponse.json(
      { error: "vault no longer in a settleable state (race lost)" },
      { status: 409 },
    );
  }

  try {
    const settled = await settleVault(vault, outcome);
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
      ok: true,
      winner: winnerParam,
      outcome,
      guaranteeTxHash: settled.guaranteeTxHash,
      subscriptionTxHash: settled.subscriptionTxHash,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "settle failed";
    await svc
      .from("vaults")
      .update({ settle_error: msg.slice(0, 500) })
      .eq("id", id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
