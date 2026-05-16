import {
  grossWithTwFee,
  twDeploy,
  twDisputeEscrow,
  twFundXDR,
  twGetEscrowBalance,
  twResolveDispute,
  twSendSignedXDR,
  verifyTxOnChain,
} from "./trustless-work";
import {
  getPlatformPublic,
  getResolverPublic,
  signWithPlatform,
  signWithResolver,
  submitSigned,
  USDC,
} from "./stellar";
import { getServiceClient } from "./supabase-server";

type Signer = "platform" | "resolver";

async function submit(xdr: string, signer: Signer): Promise<string> {
  const signed = signer === "resolver" ? signWithResolver(xdr) : signWithPlatform(xdr);
  let twErr: unknown;
  try {
    const r = await twSendSignedXDR(signed);
    if (r.hash) return r.hash;
    // SUCCESS but no hash — twSendSignedXDR already tries to compute it
    // locally. If we got here, fall through to Horizon as a last resort.
    twErr = new Error("TW send-transaction returned no hash and could not be derived");
  } catch (e) {
    twErr = e;
  }
  try {
    return await submitSigned(signed);
  } catch (horizonErr) {
    const twMsg = twErr instanceof Error ? twErr.message : String(twErr);
    const hMsg = horizonErr instanceof Error ? horizonErr.message : String(horizonErr);
    // Surface BOTH so we can tell which path actually killed us.
    throw new Error(`submit failed via TW (${twMsg}) and Horizon (${hMsg})`);
  }
}

export type SettleOutcome = "clean" | "breach";

type SettleVault = {
  id: string;
  api_url: string;
  provider_wallet: string;
  subscriber_wallet: string;
  provider_payout_target: string | null;
  subscriber_payout_target: string | null;
  guarantee_escrow_contract_id: string | null;
  subscription_escrow_contract_id: string | null;
  guarantee_usdc: number | string;
  subscription_fee_usdc: number | string;
  // Pool-mode fields. Pool-backed vaults set claim_amount_usdc; per-vault
  // listings leave it null and the per-vault settle path runs.
  claim_amount_usdc?: number | string | null;
  listing_id?: string | null;
};

export type SettleResult = {
  outcome: SettleOutcome;
  guaranteeTxHash: string | null;
  subscriptionTxHash: string | null;
};

/**
 * Outcome routing for the per-vault two-sided escrow:
 *   clean  → guarantee → provider,    subscription → provider.
 *   breach → guarantee → subscriber,  subscription → provider.
 *
 * The subscription fee always goes to the provider — they delivered the
 * service window even if uptime broke at the end. Only the guarantee shifts
 * sides on breach; that's the actual coverage payout.
 *
 * Both flows use the dispute path (dispute-escrow → resolve-dispute) since
 * resolve-dispute is the only TW call that accepts arbitrary receiver routing.
 *
 * TW's resolve-dispute requires sum(distributions.amount) == on-chain
 * balance EXACTLY. We pad the fund amount by grossWithTwFee on the subscribe
 * path so the post-fee balance lands near the quoted net, but the actual
 * distribution number must come from a runtime balance lookup — any 4dp
 * rounding mismatch trips the validator.
 */
async function releaseOne(args: {
  contractId: string;
  receiver: string;
  platform: string;
  resolver: string;
}): Promise<string | null> {
  const dispute = await twDisputeEscrow(args.contractId, args.platform);
  if (!dispute.alreadyInDispute && dispute.unsignedXDR) {
    await submit(dispute.unsignedXDR, "platform");
  }

  const balance = await twGetEscrowBalance(args.contractId);
  if (balance <= 0) {
    throw new Error(
      `escrow ${args.contractId} has no distributable balance (got ${balance}) — funding tx may not have settled on Stellar yet`
    );
  }

  const resolveXdr = await twResolveDispute(args.contractId, args.resolver, [
    { address: args.receiver, amount: balance },
  ]);
  const releaseHash = await submit(resolveXdr.unsignedXDR, "resolver");
  return releaseHash || null;
}

/**
 * Refund a single side of an unfunded vault. Used by the cron sweep when
 * `funding_expires_at` passes and only one side actually funded their escrow.
 * Releases the escrow back to the depositor (their wallet, not their payout
 * target — the deposit never became "coverage" so we route to the funding
 * source).
 */
export async function refundOneSide(args: {
  contractId: string;
  depositor: string;
}): Promise<string | null> {
  const platform = getPlatformPublic();
  const resolver = getResolverPublic();
  return await releaseOne({
    contractId: args.contractId,
    receiver: args.depositor,
    platform,
    resolver,
  });
}

/**
 * Settle dispatcher. Routes between the per-vault flow (existing) and the
 * pool flow (new). A vault is pool-backed when `claim_amount_usdc` is set;
 * for those, the provider side comes from a shared TW escrow that has to
 * be drained + re-issued on each breach.
 */
export async function settleVault(
  vault: SettleVault,
  outcome: SettleOutcome
): Promise<SettleResult> {
  if (vault.claim_amount_usdc != null && vault.listing_id) {
    return outcome === "breach"
      ? settlePoolBreach(vault)
      : settlePoolClean(vault);
  }
  return settlePerVault(vault, outcome);
}

async function settlePerVault(
  vault: SettleVault,
  outcome: SettleOutcome,
): Promise<SettleResult> {
  if (!vault.guarantee_escrow_contract_id || !vault.subscription_escrow_contract_id) {
    throw new Error("settleVault called before both escrows were deployed");
  }
  const platform = getPlatformPublic();
  const resolver = getResolverPublic();
  const providerTarget = vault.provider_payout_target ?? vault.provider_wallet;
  const subscriberTarget = vault.subscriber_payout_target ?? vault.subscriber_wallet;

  const guaranteeReceiver = outcome === "breach" ? subscriberTarget : providerTarget;
  // Subscription fee always lands with the provider — they served the
  // window. Breach only shifts the guarantee.
  const subscriptionReceiver = providerTarget;

  const guaranteeTxHash = await releaseOne({
    contractId: vault.guarantee_escrow_contract_id,
    receiver: guaranteeReceiver,
    platform,
    resolver,
  });
  const subscriptionTxHash = await releaseOne({
    contractId: vault.subscription_escrow_contract_id,
    receiver: subscriptionReceiver,
    platform,
    resolver,
  });

  return { outcome, guaranteeTxHash, subscriptionTxHash };
}

/**
 * Pool clean expiry: only the subscription escrow flips (to provider).
 * The shared pool stays funded for other subscribers — provider was never
 * "at risk" for this sub since no breach happened.
 */
async function settlePoolClean(vault: SettleVault): Promise<SettleResult> {
  if (!vault.subscription_escrow_contract_id) {
    throw new Error("pool vault clean settle: subscription escrow missing");
  }
  const platform = getPlatformPublic();
  const resolver = getResolverPublic();
  const providerTarget = vault.provider_payout_target ?? vault.provider_wallet;
  const subscriptionTxHash = await releaseOne({
    contractId: vault.subscription_escrow_contract_id,
    receiver: providerTarget,
    platform,
    resolver,
  });
  return { outcome: "clean", guaranteeTxHash: null, subscriptionTxHash };
}

/**
 * Pool breach: the dramatic one.
 *   1. Release subscriber's fee escrow → provider (they served the window;
 *      the breach payout comes from the pool, not the fee).
 *   2. Drain the listing's pool contract: claim → subscriber, remainder →
 *      platform wallet (briefly).
 *   3. Re-deploy a fresh pool escrow with the remainder and update
 *      listings.pool_contract_id so future subs hit the new one.
 *
 * Steps 2-3 are done back-to-back so the platform's custody window is
 * ~30 seconds. If step 3 fails, the platform holds the remainder and an
 * admin recovery endpoint can re-deploy later (listings.pool_error is set).
 */
async function settlePoolBreach(vault: SettleVault): Promise<SettleResult> {
  if (!vault.subscription_escrow_contract_id) {
    throw new Error("pool vault breach: subscription escrow missing");
  }
  if (!vault.listing_id) {
    throw new Error("pool vault breach: listing_id missing");
  }
  const claimAmount = Number(vault.claim_amount_usdc);
  if (!Number.isFinite(claimAmount) || claimAmount <= 0) {
    throw new Error(`pool vault breach: invalid claim_amount_usdc=${vault.claim_amount_usdc}`);
  }

  const platform = getPlatformPublic();
  const resolver = getResolverPublic();
  const providerTarget = vault.provider_payout_target ?? vault.provider_wallet;
  const subscriberTarget = vault.subscriber_payout_target ?? vault.subscriber_wallet;

  // Look up the CURRENT pool contract for the listing — earlier breaches may
  // have re-deployed it since this vault was created.
  const svc = getServiceClient();
  const { data: listing, error: lErr } = await svc
    .from("listings")
    .select("id, pool_contract_id, pool_amount_usdc, title, api_url")
    .eq("id", vault.listing_id)
    .single();
  if (lErr || !listing) {
    throw new Error(`pool vault breach: listing not found: ${lErr?.message}`);
  }
  const poolContract = listing.pool_contract_id as string | null;
  if (!poolContract) {
    throw new Error(`pool vault breach: listing.pool_contract_id is null`);
  }

  // 1) Release the subscriber's fee to the provider — they served the
  //    coverage window, the breach payout comes from the pool below.
  const subscriptionTxHash = await releaseOne({
    contractId: vault.subscription_escrow_contract_id,
    receiver: providerTarget,
    platform,
    resolver,
  });

  // 2) Drain the pool with two distributions: claim → subscriber, remainder
  //    → platform briefly.
  const dispute = await twDisputeEscrow(poolContract, platform);
  if (!dispute.alreadyInDispute && dispute.unsignedXDR) {
    await submit(dispute.unsignedXDR, "platform");
  }
  const poolBalance = await twGetEscrowBalance(poolContract);
  if (poolBalance < claimAmount) {
    throw new Error(
      `pool ${poolContract} can't cover claim: balance=${poolBalance} claim=${claimAmount}`,
    );
  }
  const remainder = round4(poolBalance - claimAmount);

  const distributions: Array<{ address: string; amount: number }> = [
    { address: subscriberTarget, amount: round4(claimAmount) },
  ];
  if (remainder > 0) {
    distributions.push({ address: platform, amount: remainder });
  }
  const resolveXdr = await twResolveDispute(poolContract, resolver, distributions);
  const poolPayoutTx = await submit(resolveXdr.unsignedXDR, "resolver");

  // 3) Re-deploy a fresh pool with the remainder and rebind the listing.
  if (remainder > 0) {
    try {
      // Wait for the resolve tx to actually settle on Horizon — TW's
      // pre-flight balance check (used by fund-escrow) reads its own indexer,
      // which lags chain by 1-2s. Without this, the platform's freshly
      // received USDC is invisible to TW and the fund call fails with
      // "insufficient funds".
      const verified = await verifyTxOnChain(poolPayoutTx, { timeoutMs: 20_000 });
      if (!verified.ok) {
        throw new Error(`resolve tx not confirmed on-chain: ${verified.reason}`);
      }

      const newDeploy = await twDeploy({
        signer: platform,
        engagementId: `${listing.id}-pool-${Date.now()}`,
        title: `crypt pool — ${listing.title}`,
        description: `Provider pool re-issued after breach payout for ${listing.api_url}`,
        roles: {
          approver: platform,
          serviceProvider: platform,
          releaseSigner: platform,
          disputeResolver: resolver,
          receiver: platform,
          platformAddress: platform,
        },
        // No commission padding — we're funding from a known on-hand balance
        // (the platform wallet just received `remainder`), and the new pool's
        // amount IS the remainder. Padding would force us to overpay TW.
        amount: remainder,
        platformFee: 0,
        milestones: [
          { description: `Pool re-issued · ${remainder.toFixed(2)} USDC remaining` },
        ],
        trustline: { symbol: USDC.code, address: USDC.issuer },
      });
      const signedDeploy = signWithPlatform(newDeploy.unsignedXDR);
      const sentDeploy = await twSendSignedXDR(signedDeploy);
      const newContractId = newDeploy.contractId ?? sentDeploy.contractId;
      if (!newContractId) {
        throw new Error(`new pool deploy returned no contractId`);
      }
      // Fund the new pool from the platform wallet, retrying on TW's
      // "insufficient funds" pre-check (indexer lag again — even after
      // verifyTxOnChain, TW can need a few extra seconds to refresh).
      await fundWithRetry({
        contractId: newContractId,
        funder: platform,
        amount: remainder,
        maxAttempts: 4,
      });
      await svc
        .from("listings")
        .update({
          pool_contract_id: newContractId,
          pool_amount_usdc: remainder,
          pool_error: null,
        })
        .eq("id", listing.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(
        `[settlePoolBreach] re-deploy failed for listing ${listing.id}: ${msg}`,
      );
      await svc
        .from("listings")
        .update({
          pool_contract_id: null,
          pool_error: `re-deploy failed: ${msg.slice(0, 400)}`,
          active: false,
        })
        .eq("id", listing.id);
    }
  } else {
    // Pool drained exactly. Nothing left to re-issue.
    await svc
      .from("listings")
      .update({ pool_contract_id: null, pool_amount_usdc: 0, active: false })
      .eq("id", listing.id);
  }

  return {
    outcome: "breach",
    guaranteeTxHash: poolPayoutTx,
    subscriptionTxHash,
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

async function fundWithRetry(args: {
  contractId: string;
  funder: string;
  amount: number;
  maxAttempts: number;
}): Promise<void> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= args.maxAttempts; attempt++) {
    try {
      const fund = await twFundXDR(args.contractId, args.funder, args.amount);
      const signedFund = signWithPlatform(fund.unsignedXDR);
      await twSendSignedXDR(signedFund);
      return;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const isLag = /insufficient funds|not.*found|indexer/i.test(msg);
      if (!isLag || attempt === args.maxAttempts) {
        throw e;
      }
      // Linear backoff — TW indexer typically catches up within 2-6s.
      await new Promise((r) => setTimeout(r, attempt * 2500));
    }
  }
  throw lastErr ?? new Error("fundWithRetry exhausted");
}
