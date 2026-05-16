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
  grossWithTwFee,
  twDeploy,
  twFundXDR,
  twSendSignedXDR,
} from "@/lib/trustless-work";

/**
 * Pool setup — POST.
 *
 * Idempotent: if the pool is already deployed (listing.pool_contract_id set),
 * we just re-issue a fresh fund XDR for the provider to sign. Otherwise we
 * deploy first (platform-signed) then return the fund XDR. Provider funds the
 * pool by signing the returned XDR and POSTing it to /pool/submit-fund.
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
    return NextResponse.json(
      { error: "pool is already funded" },
      { status: 409 },
    );
  }

  const platform = getPlatformPublic();
  let resolver: string;
  try {
    resolver = getResolverPublic();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "resolver keypair missing";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let contractId = listing.pool_contract_id as string | null;
  if (!contractId) {
    // Deploy the pool escrow. Platform is the receiver/signer; resolver
    // executes the dispute path on each breach.
    const deploy = await twDeploy({
      signer: platform,
      engagementId: `${listingId}-pool`,
      title: `crypt pool — ${listing.title}`,
      description: `Provider pool for ${listing.api_url}`,
      roles: {
        approver: platform,
        serviceProvider: platform,
        releaseSigner: platform,
        disputeResolver: resolver,
        receiver: platform,
        platformAddress: platform,
      },
      amount: grossWithTwFee(Number(listing.pool_amount_usdc)),
      platformFee: 0,
      milestones: [
        {
          description: `Pool of ${Number(listing.pool_amount_usdc).toFixed(
            2,
          )} USDC for ${listing.api_url} breach payouts`,
        },
      ],
      trustline: { symbol: USDC.code, address: USDC.issuer },
    });
    const signed = signWithPlatform(deploy.unsignedXDR);
    const sent = await twSendSignedXDR(signed);
    contractId = deploy.contractId ?? sent.contractId ?? null;
    if (!contractId) {
      return NextResponse.json(
        {
          error: `deploy succeeded but contractId missing: ${JSON.stringify(sent.raw)}`,
        },
        { status: 500 },
      );
    }
    await svc
      .from("listings")
      .update({ pool_contract_id: contractId })
      .eq("id", listingId);
  }

  const grossAmount = grossWithTwFee(Number(listing.pool_amount_usdc));
  const { unsignedXDR } = await twFundXDR(contractId, auth.address, grossAmount);
  return NextResponse.json({
    unsignedXDR,
    contractId,
    amount: grossAmount,
  });
}
