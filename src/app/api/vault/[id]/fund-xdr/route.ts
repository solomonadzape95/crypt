import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { readSession } from "@/lib/wallet-session";
import { grossWithTwFee, twFundXDR } from "@/lib/trustless-work";

type Side = "guarantee" | "subscription";

function parseSide(req: NextRequest): Side | null {
  const raw = new URL(req.url).searchParams.get("side") ?? "guarantee";
  if (raw === "guarantee" || raw === "subscription") return raw;
  return null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await readSession();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const side = parseSide(req);
  if (!side) {
    return NextResponse.json({ error: "side must be guarantee or subscription" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const svc = getServiceClient();
  const { data: vault } = await svc
    .from("vaults")
    .select(
      "id, provider_wallet, subscriber_wallet, guarantee_escrow_contract_id, subscription_escrow_contract_id, guarantee_usdc, subscription_fee_usdc"
    )
    .eq("id", id)
    .single();
  if (!vault) return NextResponse.json({ error: "vault not found" }, { status: 404 });

  const expectedFunder =
    side === "guarantee" ? vault.provider_wallet : vault.subscriber_wallet;
  if (expectedFunder !== auth.address) {
    return NextResponse.json(
      { error: `only the ${side === "guarantee" ? "provider" : "subscriber"} can fund this side` },
      { status: 403 }
    );
  }

  const contractId =
    side === "guarantee"
      ? vault.guarantee_escrow_contract_id
      : vault.subscription_escrow_contract_id;
  if (!contractId) {
    return NextResponse.json({ error: `${side} escrow not deployed` }, { status: 409 });
  }

  // The displayed/payout figure is net. Fund the gross so TW's protocol
  // commission lands the on-chain balance exactly on the net amount.
  const netAmount =
    side === "guarantee" ? Number(vault.guarantee_usdc) : Number(vault.subscription_fee_usdc);
  const grossAmount = grossWithTwFee(netAmount);

  const { unsignedXDR } = await twFundXDR(contractId, expectedFunder, grossAmount);
  return NextResponse.json({ unsignedXDR, side, amount: grossAmount });
}
