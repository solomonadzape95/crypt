import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { readSession } from "@/lib/wallet-session";
import { twSendSignedXDR, verifyTxOnChain } from "@/lib/trustless-work";
import { submitSigned } from "@/lib/stellar";

type Body = { signedXDR: string };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await readSession();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id: listingId } = await ctx.params;
  const { signedXDR } = (await req.json()) as Body;
  if (!signedXDR) {
    return NextResponse.json({ error: "missing signedXDR" }, { status: 400 });
  }

  const svc = getServiceClient();
  const { data: listing } = await svc
    .from("listings")
    .select(
      "provider_wallet, payout_mode, pool_contract_id, pool_funded_at, active",
    )
    .eq("id", listingId)
    .single();
  if (!listing) {
    return NextResponse.json({ error: "listing not found" }, { status: 404 });
  }
  if (listing.provider_wallet !== auth.address) {
    return NextResponse.json({ error: "not your listing" }, { status: 403 });
  }
  if (listing.payout_mode !== "pool") {
    return NextResponse.json(
      { error: "this listing is not pool-mode" },
      { status: 400 },
    );
  }
  if (listing.pool_funded_at) {
    return NextResponse.json({ error: "pool is already funded" }, { status: 409 });
  }
  if (!listing.pool_contract_id) {
    return NextResponse.json(
      { error: "pool not deployed yet — call /pool/setup first" },
      { status: 409 },
    );
  }

  // Submit via TW first; fall back to Horizon. Same defensive pattern as
  // submit-fund for vaults — never mark the pool funded without a real
  // confirmed tx hash.
  let txHash: string | null = null;
  let twErr: string | null = null;
  let horizonErr: string | null = null;
  try {
    txHash = (await twSendSignedXDR(signedXDR)).hash;
  } catch (e) {
    twErr = e instanceof Error ? e.message : String(e);
  }
  if (!txHash) {
    try {
      txHash = await submitSigned(signedXDR);
    } catch (e) {
      horizonErr = e instanceof Error ? e.message : String(e);
    }
  }
  if (!txHash) {
    const detail = [twErr, horizonErr].filter(Boolean).join(" | ");
    return NextResponse.json(
      { error: "pool fund tx failed on Stellar: " + detail },
      { status: 502 },
    );
  }
  const verify = await verifyTxOnChain(txHash);
  if (!verify.ok) {
    return NextResponse.json(
      {
        error:
          "Pool fund tx was submitted but reverted on chain. Check USDC balance + trustline. tx=" +
          txHash +
          " — " +
          verify.reason,
      },
      { status: 502 },
    );
  }

  await svc
    .from("listings")
    .update({
      pool_funded_at: new Date().toISOString(),
      active: true,
    })
    .eq("id", listingId);

  return NextResponse.json({ txHash, listingId });
}
