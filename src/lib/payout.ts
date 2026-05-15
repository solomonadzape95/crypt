import {
  twDisputeEscrow,
  twGetEscrowBalance,
  twResolveDispute,
  twSendSignedXDR,
} from "./trustless-work";
import {
  getPlatformPublic,
  getResolverPublic,
  signWithPlatform,
  signWithResolver,
  submitSigned,
} from "./stellar";

type Signer = "platform" | "resolver";

async function submit(xdr: string, signer: Signer): Promise<string> {
  const signed = signer === "resolver" ? signWithResolver(xdr) : signWithPlatform(xdr);
  try {
    const r = await twSendSignedXDR(signed);
    return r.hash ?? "";
  } catch {
    return await submitSigned(signed);
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
};

export type SettleResult = {
  outcome: SettleOutcome;
  guaranteeTxHash: string | null;
  subscriptionTxHash: string | null;
};

/**
 * Outcome routing for the two-sided vault:
 *   clean  → guarantee → provider,    subscription → provider.
 *   breach → guarantee → subscriber,  subscription → subscriber.
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

export async function settleVault(
  vault: SettleVault,
  outcome: SettleOutcome
): Promise<SettleResult> {
  if (!vault.guarantee_escrow_contract_id || !vault.subscription_escrow_contract_id) {
    throw new Error("settleVault called before both escrows were deployed");
  }
  const platform = getPlatformPublic();
  const resolver = getResolverPublic();
  const providerTarget = vault.provider_payout_target ?? vault.provider_wallet;
  const subscriberTarget = vault.subscriber_payout_target ?? vault.subscriber_wallet;

  const guaranteeReceiver = outcome === "breach" ? subscriberTarget : providerTarget;
  const subscriptionReceiver = outcome === "breach" ? subscriberTarget : providerTarget;

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
