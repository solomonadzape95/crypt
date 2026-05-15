import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { readSession } from "@/lib/wallet-session";
import { Keypair } from "@stellar/stellar-sdk";

type Body = {
  title: string;
  description?: string;
  apiUrl: string;
  oraclePeriodSec: number;
  failureThreshold?: number;
  slaTargetPct?: number;
  guaranteeUsdc: number;
  subscriptionFeeUsdc: number;
  providerPayoutTarget?: string;
  boundlessUrl?: string | null;
};

function isValidStellarAddress(addr: string): boolean {
  try {
    Keypair.fromPublicKey(addr);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const auth = await readSession();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await req.json()) as Body;
  if (!body.title || !body.apiUrl || !body.oraclePeriodSec) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }
  try {
    new URL(body.apiUrl);
  } catch {
    return NextResponse.json({ error: "api_url must be a valid URL" }, { status: 400 });
  }
  if (body.guaranteeUsdc <= 0 || body.guaranteeUsdc > 50) {
    return NextResponse.json(
      { error: "guarantee must be between 0 and 50 USDC for hackathon" },
      { status: 400 }
    );
  }
  if (body.subscriptionFeeUsdc <= 0 || body.subscriptionFeeUsdc > 200) {
    return NextResponse.json(
      { error: "subscription fee must be between 0 and 200 USDC for hackathon" },
      { status: 400 }
    );
  }
  if (body.oraclePeriodSec < 5 || body.oraclePeriodSec > 3600) {
    return NextResponse.json(
      { error: "oracle_period_sec must be between 5 and 3600" },
      { status: 400 }
    );
  }
  const payoutTarget = body.providerPayoutTarget?.trim() || auth.address;
  if (!isValidStellarAddress(payoutTarget)) {
    return NextResponse.json(
      { error: "payout target is not a valid Stellar address" },
      { status: 400 }
    );
  }

  const svc = getServiceClient();
  const { data, error } = await svc
    .from("listings")
    .insert({
      provider_wallet: auth.address,
      provider_payout_target: payoutTarget,
      title: body.title.slice(0, 120),
      description: body.description?.slice(0, 800) ?? null,
      api_url: body.apiUrl,
      oracle_period_sec: body.oraclePeriodSec,
      failure_threshold: body.failureThreshold ?? 3,
      sla_target_pct: body.slaTargetPct ?? 99.9,
      guarantee_usdc: body.guaranteeUsdc,
      subscription_fee_usdc: body.subscriptionFeeUsdc,
      boundless_url: body.boundlessUrl ?? null,
      active: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }
  return NextResponse.json({ listingId: data.id });
}
