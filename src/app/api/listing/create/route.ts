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
  expectBodyRegex?: string | null;
  coverageDays?: number[];
  payoutMode?: "per_vault" | "pool";
  poolAmountUsdc?: number;
  coverageRatioX?: number;
};

const COVERAGE_MULTIPLIERS: Record<number, number> = {
  7: 1,
  30: 4,
  90: 11,
};

function isValidStellarAddress(addr: string): boolean {
  try {
    Keypair.fromPublicKey(addr);
    return true;
  } catch {
    return false;
  }
}

function validateRegex(input: string | null | undefined): string | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;
  try {
    new RegExp(trimmed);
    return trimmed;
  } catch {
    throw new Error("expect_body_regex is not a valid regular expression");
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
  const payoutMode = body.payoutMode ?? "per_vault";
  if (payoutMode === "per_vault") {
    if (body.guaranteeUsdc <= 0 || body.guaranteeUsdc > 50) {
      return NextResponse.json(
        { error: "guarantee must be between 0 and 50 USDC for hackathon" },
        { status: 400 }
      );
    }
  } else {
    if (
      !body.poolAmountUsdc ||
      body.poolAmountUsdc < 50 ||
      body.poolAmountUsdc > 10000
    ) {
      return NextResponse.json(
        { error: "pool amount must be between 50 and 10000 USDC" },
        { status: 400 }
      );
    }
    if (
      !body.coverageRatioX ||
      body.coverageRatioX < 1 ||
      body.coverageRatioX > 100
    ) {
      return NextResponse.json(
        { error: "coverage ratio must be between 1× and 100×" },
        { status: 400 }
      );
    }
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

  let expectBodyRegex: string | null;
  try {
    expectBodyRegex = validateRegex(body.expectBodyRegex);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "invalid regex" },
      { status: 400 }
    );
  }

  // Coverage period options. Defaults to all three when omitted. Multipliers
  // are fixed; provider only chooses which days are offered.
  const coverageDays =
    body.coverageDays && body.coverageDays.length > 0 ? body.coverageDays : [7, 30, 90];
  const periodOptions: Array<{ days: number; multiplier: number }> = [];
  for (const d of coverageDays) {
    const m = COVERAGE_MULTIPLIERS[d];
    if (!m) {
      return NextResponse.json(
        { error: `coverage period ${d}d not supported (allowed: 7, 30, 90)` },
        { status: 400 }
      );
    }
    periodOptions.push({ days: d, multiplier: m });
  }
  periodOptions.sort((a, b) => a.days - b.days);

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
      expect_body_regex: expectBodyRegex,
      period_options: periodOptions,
      payout_mode: payoutMode,
      pool_amount_usdc: payoutMode === "pool" ? body.poolAmountUsdc : null,
      coverage_ratio_x: payoutMode === "pool" ? body.coverageRatioX : null,
      pool_payout_target: payoutMode === "pool" ? payoutTarget : null,
      // Pool listings start inactive — they need to be funded before they
      // accept subscribers. The fund-pool flow flips active=true on success.
      active: payoutMode === "per_vault",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }
  return NextResponse.json({
    listingId: data.id,
    needsPoolFunding: payoutMode === "pool",
  });
}
