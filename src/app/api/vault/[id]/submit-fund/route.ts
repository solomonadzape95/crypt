import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { readSession } from "@/lib/wallet-session";
import { twSendSignedXDR, verifyTxOnChain } from "@/lib/trustless-work";
import { submitSigned } from "@/lib/stellar";

type Side = "guarantee" | "subscription";

type Body = {
  signedXDR: string;
  side: Side;
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await readSession();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const { signedXDR, side } = (await req.json()) as Body;
  if (!signedXDR) return NextResponse.json({ error: "missing signedXDR" }, { status: 400 });
  if (side !== "guarantee" && side !== "subscription") {
    return NextResponse.json({ error: "side must be guarantee or subscription" }, { status: 400 });
  }

  const svc = getServiceClient();
  const { data: vault } = await svc
    .from("vaults")
    .select(
      "provider_wallet, subscriber_wallet, status, guarantee_funded_at, subscription_funded_at"
    )
    .eq("id", id)
    .single();
  if (!vault) {
    return NextResponse.json({ error: "vault not found" }, { status: 404 });
  }
  const expectedFunder =
    side === "guarantee" ? vault.provider_wallet : vault.subscriber_wallet;
  if (expectedFunder !== auth.address) {
    return NextResponse.json(
      { error: `only the ${side === "guarantee" ? "provider" : "subscriber"} can fund this side` },
      { status: 403 }
    );
  }

  // Submit via TW first; fall back to direct Horizon submit only if TW's
  // submit fails outright. NEVER mark the vault as funded without a real
  // tx hash — that's how we ended up locking vaults with empty escrows.
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
    console.error(`[submit-fund] fund tx failed for vault ${id} side ${side}: ${detail}`);
    return NextResponse.json(
      {
        error:
          "Funding transaction failed on Stellar. Check that your wallet has enough USDC and the USDC trustline is set up. Original error: " +
          detail,
      },
      { status: 502 }
    );
  }

  // TW reports "SUCCESS" on submission, but the host function inside the
  // Soroban tx can still revert (e.g. fund_escrow reverts on insufficient
  // USDC). Confirm the tx is `successful: true` on Horizon before marking
  // the escrow funded — otherwise we end up with an empty escrow and a
  // "locked" vault that can never settle.
  const verify = await verifyTxOnChain(txHash);
  if (!verify.ok) {
    console.error(`[submit-fund] tx ${txHash} did not succeed on-chain: ${verify.reason}`);
    return NextResponse.json(
      {
        error:
          "Funding transaction was submitted but did not succeed on Stellar — the on-chain call reverted. This usually means your wallet is short on USDC, missing the USDC trustline, or the escrow contract isn't ready. Tx: " +
          txHash +
          " — " +
          verify.reason,
      },
      { status: 502 }
    );
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> =
    side === "guarantee"
      ? { guarantee_fund_tx_hash: txHash, guarantee_funded_at: now }
      : { subscription_fund_tx_hash: txHash, subscription_funded_at: now };

  // Flip to locked once both sides are funded.
  const otherSideFunded =
    side === "guarantee" ? !!vault.subscription_funded_at : !!vault.guarantee_funded_at;
  if (otherSideFunded && vault.status === "funding") {
    update.status = "locked";
  }

  await svc.from("vaults").update(update).eq("id", id);

  return NextResponse.json({ txHash, side, bothFunded: otherSideFunded });
}
