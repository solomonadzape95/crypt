import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { readSession } from "@/lib/wallet-session";
import {
  getPlatformPublic,
  getResolverPublic,
  signWithPlatform,
  USDC,
} from "@/lib/stellar";
import {
  twDeploy,
  twFundXDR,
  twSendSignedXDR,
} from "@/lib/trustless-work";

/**
 * Pool recovery — POST.
 *
 * When a breach-time pool re-deploy fails (TW indexer lag, network blip),
 * the platform still holds the remainder USDC and the listing is marked
 * inactive with `pool_error` set. This endpoint retries the deploy + fund
 * using the saved `pool_amount_usdc` (which was rewritten to the remainder
 * before the failure).
 *
 * Provider-only — they own the funds the platform is custodying.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await readSession();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id: listingId } = await ctx.params;
  const svc = getServiceClient();
  const { data: listing } = await svc
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .single();
  if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });
  if (listing.provider_wallet !== auth.address) {
    return NextResponse.json({ error: "not your listing" }, { status: 403 });
  }
  if (listing.payout_mode !== "pool") {
    return NextResponse.json({ error: "not a pool listing" }, { status: 400 });
  }
  if (listing.pool_contract_id) {
    return NextResponse.json(
      { error: "pool already has a contract — nothing to recover" },
      { status: 409 },
    );
  }
  const remainder = Number(listing.pool_amount_usdc ?? 0);
  if (remainder <= 0) {
    return NextResponse.json(
      { error: "no remainder to recover" },
      { status: 409 },
    );
  }

  const platform = getPlatformPublic();
  let resolver: string;
  try {
    resolver = getResolverPublic();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "resolver missing" },
      { status: 500 },
    );
  }

  try {
    const deploy = await twDeploy({
      signer: platform,
      engagementId: `${listing.id}-pool-recover-${Date.now()}`,
      title: `crypt pool — ${listing.title}`,
      description: `Provider pool recovered for ${listing.api_url}`,
      roles: {
        approver: platform,
        serviceProvider: platform,
        releaseSigner: platform,
        disputeResolver: resolver,
        receiver: platform,
        platformAddress: platform,
      },
      amount: remainder,
      platformFee: 0,
      milestones: [
        { description: `Pool recovered · ${remainder.toFixed(2)} USDC` },
      ],
      trustline: { symbol: USDC.code, address: USDC.issuer },
    });
    const signedDeploy = signWithPlatform(deploy.unsignedXDR);
    const sentDeploy = await twSendSignedXDR(signedDeploy);
    const newContractId = deploy.contractId ?? sentDeploy.contractId;
    if (!newContractId) {
      throw new Error("recover deploy returned no contractId");
    }
    const fund = await twFundXDR(newContractId, platform, remainder);
    const signedFund = signWithPlatform(fund.unsignedXDR);
    await twSendSignedXDR(signedFund);

    await svc
      .from("listings")
      .update({
        pool_contract_id: newContractId,
        pool_error: null,
        active: true,
      })
      .eq("id", listingId);
    return NextResponse.json({ ok: true, poolContractId: newContractId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "recover failed";
    await svc
      .from("listings")
      .update({ pool_error: `recover failed: ${msg.slice(0, 400)}` })
      .eq("id", listingId);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
