import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { readSession } from "@/lib/wallet-session";
import { getPlatformPublic, getResolverPublic, signWithPlatform, USDC } from "@/lib/stellar";
import { grossWithTwFee, twDeploy, twSendSignedXDR } from "@/lib/trustless-work";
import { Keypair } from "@stellar/stellar-sdk";

type Body = {
  subscriberPayoutTarget?: string;
  periodDays?: number;
};

type ListingPeriodOption = { days: number; multiplier: number };

const FUNDING_TTL_MS = 24 * 60 * 60_000; // 24h to fund both sides — cron sweeps after

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

  const periodOptions = (listing.period_options as ListingPeriodOption[]) ?? [
    { days: 7, multiplier: 1 },
  ];
  const periodDays = body.periodDays ?? periodOptions[0]?.days ?? 7;
  const chosen = periodOptions.find((o) => o.days === periodDays);
  if (!chosen) {
    return NextResponse.json(
      { error: `period ${periodDays}d not offered by this listing` },
      { status: 400 }
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + chosen.days * 24 * 60 * 60_000);
  const fundingExpiresAt = new Date(now.getTime() + FUNDING_TTL_MS);
  const subscriptionFee = Number(listing.subscription_fee_usdc) * chosen.multiplier;
  const isPool = listing.payout_mode === "pool";

  // Pool capacity check — refuse new subs when the unspent pool can't cover
  // their potential claim.
  let claimAmount: number | null = null;
  if (isPool) {
    if (!listing.pool_contract_id || !listing.pool_funded_at) {
      return NextResponse.json(
        { error: "pool is not funded yet — provider must deposit first" },
        { status: 409 },
      );
    }
    const ratio = Number(listing.coverage_ratio_x ?? 10);
    claimAmount = subscriptionFee * ratio;
    const { data: reservedRows } = await svc
      .from("vaults")
      .select("claim_amount_usdc")
      .eq("listing_id", listing.id)
      .in("status", ["funding", "locked", "under_threat"])
      .in("dispute_status", ["none", "pending", "in_review"]);
    const reserved = (reservedRows ?? []).reduce(
      (s, r) => s + Number(r.claim_amount_usdc ?? 0),
      0,
    );
    const available = Number(listing.pool_amount_usdc ?? 0) - reserved;
    if (available < claimAmount) {
      return NextResponse.json(
        {
          error: `pool oversubscribed — only ${available.toFixed(2)} USDC of capacity left, this plan claims ${claimAmount.toFixed(2)}`,
        },
        { status: 409 },
      );
    }
  }

  // Snapshot listing terms into the new vault row. For pool vaults we point
  // guarantee_escrow_contract_id at the shared pool so existing UI links keep
  // working, and pre-fill guarantee_funded_at so the funding state machine
  // doesn't wait for a per-vault provider deposit (the pool was funded once
  // by the provider, before any subscribers existed).
  const { data: vault, error: insErr } = await svc
    .from("vaults")
    .insert({
      listing_id: listing.id,
      provider_wallet: listing.provider_wallet,
      provider_payout_target: listing.provider_payout_target,
      subscriber_wallet: auth.address,
      subscriber_payout_target: subscriberPayoutTarget,
      api_url: listing.api_url,
      guarantee_usdc: isPool ? claimAmount : listing.guarantee_usdc,
      subscription_fee_usdc: subscriptionFee,
      oracle_period_sec: listing.oracle_period_sec,
      failure_threshold: listing.failure_threshold,
      sla_target_pct: listing.sla_target_pct,
      expect_body_regex: listing.expect_body_regex,
      period_days: chosen.days,
      expires_at: expiresAt.toISOString(),
      funding_expires_at: fundingExpiresAt.toISOString(),
      status: "funding",
      // Pool-only fields:
      claim_amount_usdc: claimAmount,
      pool_contract_snapshot: isPool ? listing.pool_contract_id : null,
      guarantee_escrow_contract_id: isPool ? listing.pool_contract_id : null,
      guarantee_funded_at: isPool ? listing.pool_funded_at : null,
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

  let guarantee: { contractId: string; deployTxHash: string | null } | null = null;
  let subscription: { contractId: string; deployTxHash: string | null };
  try {
    if (!isPool) {
      guarantee = await deployEscrow({
        vaultId: vault.id,
        side: "guarantee",
        platform,
        resolver,
        amount: Number(listing.guarantee_usdc),
        apiUrl: listing.api_url,
      });
    }
    subscription = await deployEscrow({
      vaultId: vault.id,
      side: "subscription",
      platform,
      resolver,
      amount: subscriptionFee,
      apiUrl: listing.api_url,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "deploy failed";
    return NextResponse.json({ error: msg, vaultId: vault.id }, { status: 500 });
  }

  const update: Record<string, unknown> = {
    subscription_escrow_contract_id: subscription.contractId,
  };
  if (!isPool && guarantee) {
    update.guarantee_escrow_contract_id = guarantee.contractId;
  }
  await svc.from("vaults").update(update).eq("id", vault.id);

  return NextResponse.json({
    vaultId: vault.id,
    payoutMode: listing.payout_mode,
    claimAmount,
    guarantee: guarantee
      ? {
          contractId: guarantee.contractId,
          deployTxHash: guarantee.deployTxHash,
        }
      : { contractId: listing.pool_contract_id, deployTxHash: null },
    subscription: {
      contractId: subscription.contractId,
      deployTxHash: subscription.deployTxHash,
    },
  });
}
