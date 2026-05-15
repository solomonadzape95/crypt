import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { readSession } from "@/lib/wallet-session";
import { settleVault } from "@/lib/payout";

/**
 * Manual breach settlement — for the demo. Either party may invoke. Settles
 * the two-sided release first; only on success flips status to `disbursed`.
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
  if (vault.status === "disbursed") {
    return NextResponse.json({
      already: true,
      guaranteePayoutTxHash: vault.guarantee_payout_tx_hash,
      subscriptionPayoutTxHash: vault.subscription_payout_tx_hash,
    });
  }
  if (vault.status === "funding") {
    return NextResponse.json({ error: "vault not yet funded" }, { status: 409 });
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
        triggered_at: new Date().toISOString(),
        guarantee_payout_tx_hash: settled.guaranteeTxHash,
        subscription_payout_tx_hash: settled.subscriptionTxHash,
        settle_error: null,
      })
      .eq("id", id);
    return NextResponse.json({
      status: "disbursed",
      guaranteePayoutTxHash: settled.guaranteeTxHash,
      subscriptionPayoutTxHash: settled.subscriptionTxHash,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "settlement failed";
    await svc
      .from("vaults")
      .update({ settle_error: msg.slice(0, 500) })
      .eq("id", id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
