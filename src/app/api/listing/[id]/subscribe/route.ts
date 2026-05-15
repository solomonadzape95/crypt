import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { readSession } from "@/lib/wallet-session";
import { getPlatformPublic, getResolverPublic, signWithPlatform, USDC } from "@/lib/stellar";
import { grossWithTwFee, twDeploy, twSendSignedXDR } from "@/lib/trustless-work";
import { Keypair } from "@stellar/stellar-sdk";

type Body = {
  subscriberPayoutTarget?: string;
};

function isValidStellarAddress(addr: string): boolean {
  try {
    Keypair.fromPublicKey(addr);
    return true;
  } catch {
    return false;
  }
}

async function deployEscrow(args: {
  vaultId: string;
  side: "guarantee" | "subscription";
  platform: string;
  resolver: string;
  amount: number;
  apiUrl: string;
}): Promise<{ contractId: string; deployTxHash: string | null }> {
  const titlePrefix =
    args.side === "guarantee" ? "API Safety Net — guarantee" : "API Safety Net — subscription";
  const description =
    args.side === "guarantee"
      ? `Provider guarantee for ${args.apiUrl}`
      : `Subscriber subscription fee for ${args.apiUrl}`;

  const deploy = await twDeploy({
    signer: args.platform,
    engagementId: `${args.vaultId}-${args.side}`,
    title: `${titlePrefix}: ${args.apiUrl}`,
    description,
    roles: {
      approver: args.platform,
      serviceProvider: args.platform,
      releaseSigner: args.platform,
      disputeResolver: args.resolver,
      receiver: args.platform,
      platformAddress: args.platform,
    },
    // Pad by TW's commission so the post-commission balance equals the net
    // amount the user was quoted, which is what we'll distribute on settle.
    amount: grossWithTwFee(args.amount),
    platformFee: 0,
    milestones: [
      {
        description:
          args.side === "guarantee"
            ? "SLA maintained — no qualifying outage detected"
            : "Subscription period served — no qualifying outage detected",
      },
    ],
    trustline: { symbol: USDC.code, address: USDC.issuer },
  });

  const signed = signWithPlatform(deploy.unsignedXDR);
  const sent = await twSendSignedXDR(signed);
  const contractId = deploy.contractId ?? sent.contractId;
  if (!contractId) {
    throw new Error(
      `deploy succeeded but contractId missing for ${args.side} escrow: ${JSON.stringify(sent.raw)}`
    );
  }
  return { contractId, deployTxHash: sent.hash };
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await readSession();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id: listingId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;
  const subscriberPayoutTarget = body.subscriberPayoutTarget?.trim() || auth.address;
  if (!isValidStellarAddress(subscriberPayoutTarget)) {
    return NextResponse.json(
      { error: "payout target is not a valid Stellar address" },
      { status: 400 }
    );
  }

  const svc = getServiceClient();
  const { data: listing } = await svc
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .single();
  if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });
  if (!listing.active) {
    return NextResponse.json({ error: "listing is not active" }, { status: 409 });
  }

  // Snapshot listing terms into the new vault row.
  const { data: vault, error: insErr } = await svc
    .from("vaults")
    .insert({
      listing_id: listing.id,
      provider_wallet: listing.provider_wallet,
      provider_payout_target: listing.provider_payout_target,
      subscriber_wallet: auth.address,
      subscriber_payout_target: subscriberPayoutTarget,
      api_url: listing.api_url,
      guarantee_usdc: listing.guarantee_usdc,
      subscription_fee_usdc: listing.subscription_fee_usdc,
      oracle_period_sec: listing.oracle_period_sec,
      failure_threshold: listing.failure_threshold,
      sla_target_pct: listing.sla_target_pct,
      boundless_url: listing.boundless_url,
      status: "funding",
    })
    .select("id")
    .single();
  if (insErr || !vault) {
    return NextResponse.json(
      { error: insErr?.message ?? "insert failed" },
      { status: 500 }
    );
  }

  const platform = getPlatformPublic();
  let resolver: string;
  try {
    resolver = getResolverPublic();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "resolver keypair missing";
    return NextResponse.json({ error: msg, vaultId: vault.id }, { status: 500 });
  }
  let guarantee: { contractId: string; deployTxHash: string | null };
  let subscription: { contractId: string; deployTxHash: string | null };
  try {
    guarantee = await deployEscrow({
      vaultId: vault.id,
      side: "guarantee",
      platform,
      resolver,
      amount: Number(listing.guarantee_usdc),
      apiUrl: listing.api_url,
    });
    subscription = await deployEscrow({
      vaultId: vault.id,
      side: "subscription",
      platform,
      resolver,
      amount: Number(listing.subscription_fee_usdc),
      apiUrl: listing.api_url,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "deploy failed";
    return NextResponse.json({ error: msg, vaultId: vault.id }, { status: 500 });
  }

  await svc
    .from("vaults")
    .update({
      guarantee_escrow_contract_id: guarantee.contractId,
      subscription_escrow_contract_id: subscription.contractId,
    })
    .eq("id", vault.id);

  return NextResponse.json({
    vaultId: vault.id,
    guarantee: {
      contractId: guarantee.contractId,
      deployTxHash: guarantee.deployTxHash,
    },
    subscription: {
      contractId: subscription.contractId,
      deployTxHash: subscription.deployTxHash,
    },
  });
}
