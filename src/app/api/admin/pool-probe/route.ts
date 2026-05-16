import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getPlatformPublic,
  getResolverPublic,
  signWithPlatform,
  signWithResolver,
  USDC,
} from "@/lib/stellar";
import {
  twDeploy,
  twDisputeEscrow,
  twFundXDR,
  twGetEscrowBalance,
  twResolveDispute,
  twSendSignedXDR,
  verifyTxOnChain,
} from "@/lib/trustless-work";

/**
 * Pool probe — POST. Admin-only.
 *
 * Stand-alone validator for the pool deploy/fund/drain cycle, run against
 * the platform wallet using a tiny throwaway amount. Useful in prod to
 * confirm the wallet has USDC + a working trustline + TW indexer freshness,
 * without touching any real listing.
 *
 *   POST /api/admin/pool-probe?amount=1
 *
 * Steps:
 *   1. Deploy a one-shot escrow at $amount.
 *   2. Fund it from the platform wallet.
 *   3. Verify the fund tx on-chain.
 *   4. Read the escrow balance (proves TW indexer sees it).
 *   5. Dispute + resolve the full balance back to the platform wallet.
 *
 * Returns each step's outcome for diagnosis.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const amount = Math.max(
    0.5,
    Math.min(5, Number(new URL(req.url).searchParams.get("amount") ?? 1)),
  );
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

  const trace: Record<string, unknown> = { amount };

  try {
    // 1. Deploy.
    const deploy = await twDeploy({
      signer: platform,
      engagementId: `probe-${Date.now()}`,
      title: `pool probe · ${amount} USDC`,
      description: "Pool probe — throwaway escrow for prod diagnostics",
      roles: {
        approver: platform,
        serviceProvider: platform,
        releaseSigner: platform,
        disputeResolver: resolver,
        receiver: platform,
        platformAddress: platform,
      },
      amount,
      platformFee: 0,
      milestones: [{ description: "probe" }],
      trustline: { symbol: USDC.code, address: USDC.issuer },
    });
    const signedDeploy = signWithPlatform(deploy.unsignedXDR);
    const sentDeploy = await twSendSignedXDR(signedDeploy);
    const contractId = deploy.contractId ?? sentDeploy.contractId;
    if (!contractId) throw new Error("deploy returned no contractId");
    trace.deploy = { contractId, txHash: sentDeploy.hash };

    // 2. Fund.
    const fund = await twFundXDR(contractId, platform, amount);
    const signedFund = signWithPlatform(fund.unsignedXDR);
    const sentFund = await twSendSignedXDR(signedFund);
    trace.fund = { txHash: sentFund.hash };

    // 3. Verify on chain.
    if (sentFund.hash) {
      const verified = await verifyTxOnChain(sentFund.hash, { timeoutMs: 15_000 });
      trace.verifyFund = verified;
      if (!verified.ok) {
        return NextResponse.json(
          { error: "fund tx not confirmed on-chain", trace },
          { status: 502 },
        );
      }
    }

    // 4. Read balance via TW indexer.
    const balance = await twGetEscrowBalance(contractId);
    trace.balanceAfterFund = balance;

    // 5. Dispute + resolve back to platform.
    const dispute = await twDisputeEscrow(contractId, platform);
    if (!dispute.alreadyInDispute && dispute.unsignedXDR) {
      const signedDispute = signWithPlatform(dispute.unsignedXDR);
      const sentDispute = await twSendSignedXDR(signedDispute);
      trace.dispute = { txHash: sentDispute.hash };
    } else {
      trace.dispute = { alreadyInDispute: true };
    }
    const resolveBalance = await twGetEscrowBalance(contractId);
    const resolveXdr = await twResolveDispute(contractId, resolver, [
      { address: platform, amount: resolveBalance },
    ]);
    const signedResolve = signWithResolver(resolveXdr.unsignedXDR);
    const sentResolve = await twSendSignedXDR(signedResolve);
    trace.resolve = { txHash: sentResolve.hash, returned: resolveBalance };

    return NextResponse.json({ ok: true, trace });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg, trace },
      { status: 502 },
    );
  }
}
