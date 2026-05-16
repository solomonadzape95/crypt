import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-auth";
import { settleVault } from "@/lib/payout";

type Body = { winner: "provider" | "subscriber" };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const adminAddress = auth.address;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;
  if (body.winner !== "provider" && body.winner !== "subscriber") {
    return NextResponse.json(
      { error: "winner must be 'provider' or 'subscriber'" },
      { status: 400 }
    );
  }

  const svc = getServiceClient();

  // Atomic claim — only one admin can flip an in_review vault to resolved.
  const newStatus =
    body.winner === "provider" ? "resolved_provider" : "resolved_subscriber";
  const { data: claimed, error: claimErr } = await svc
    .from("vaults")
    .update({
      dispute_status: newStatus,
      dispute_resolved_by: adminAddress,
      dispute_resolved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("dispute_status", "in_review")
    .select("*");
  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 });
  if (!claimed || claimed.length === 0) {
    return NextResponse.json(
      { error: "vault is not in_review (already resolved or not disputed)" },
      { status: 409 }
    );
  }
  const vault = claimed[0];

  try {
    const settled = await settleVault(
      vault,
      body.winner === "provider" ? "clean" : "breach"
    );
    if (!settled.guaranteeTxHash || !settled.subscriptionTxHash) {
      throw new Error(
        `settle returned null tx hash (g=${settled.guaranteeTxHash}, s=${settled.subscriptionTxHash})`
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
      ok: true,
      winner: body.winner,
      guaranteeTxHash: settled.guaranteeTxHash,
      subscriptionTxHash: settled.subscriptionTxHash,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "settle failed";
    await svc.from("vaults").update({ settle_error: msg.slice(0, 500) }).eq("id", id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
