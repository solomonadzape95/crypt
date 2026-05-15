// Trustless Work REST wrapper.
// Server-side only — never import from a Client Component.
//
// Endpoint shapes verified against https://dev.api.trustlesswork.com/docs-json
// on 2026-05-15.

const BASE_URL =
  process.env.TRUSTLESS_WORK_BASE_URL ?? "https://dev.api.trustlesswork.com";

function apiKey(): string {
  const k = process.env.TRUSTLESS_WORK_API_KEY;
  if (!k) throw new Error("TRUSTLESS_WORK_API_KEY is not set");
  return k;
}

async function tw<T>(
  path: string,
  body: Record<string, unknown>,
  method: "POST" | "GET" = "POST"
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey(),
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TW ${path} → ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// ── types ──────────────────────────────────────────────────────────────────

export type TWRoles = {
  approver: string;
  serviceProvider: string;
  releaseSigner: string;
  disputeResolver: string;
  receiver: string;
  platformAddress: string;
};

export type TWTrustline = {
  /** Asset code, e.g. "USDC" */
  symbol: string;
  /** Issuer Stellar address */
  address: string;
};

export type TWMilestoneInput = { description: string };

export type TWDeployBody = {
  signer: string;
  engagementId: string;
  title: string;
  description: string;
  roles: TWRoles;
  amount: number;
  platformFee: number;
  milestones: TWMilestoneInput[];
  trustline: TWTrustline;
};

/** TW responses don't have a documented schema; pluck XDR from common field names. */
export type TWXDRResponse = {
  unsignedTransaction?: string;
  unsignedXdr?: string;
  xdr?: string;
  contractId?: string;
};

function pickXDR(r: TWXDRResponse): string {
  const x = r.unsignedTransaction ?? r.unsignedXdr ?? r.xdr;
  if (!x) {
    throw new Error(
      `TW response missing unsignedTransaction/unsignedXdr/xdr — got keys: ${Object.keys(r).join(",")}`
    );
  }
  return x;
}

// ── calls ──────────────────────────────────────────────────────────────────

export async function twDeploy(b: TWDeployBody): Promise<{
  unsignedXDR: string;
  /** contractId may already be in the deploy response on some TW versions */
  contractId: string | null;
}> {
  const r = await tw<TWXDRResponse>(
    "/deployer/single-release",
    b as unknown as Record<string, unknown>
  );
  return { unsignedXDR: pickXDR(r), contractId: r.contractId ?? null };
}

export async function twFundXDR(
  contractId: string,
  signer: string,
  amountUsdc: number
): Promise<{ unsignedXDR: string }> {
  const r = await tw<TWXDRResponse>("/escrow/single-release/fund-escrow", {
    contractId,
    signer,
    amount: amountUsdc,
  });
  return { unsignedXDR: pickXDR(r) };
}

export async function twSendSignedXDR(signedXDR: string): Promise<{
  hash: string | null;
  contractId: string | null;
  raw: Record<string, unknown>;
}> {
  const r = await tw<Record<string, unknown>>("/helper/send-transaction", {
    signedXdr: signedXDR,
  });
  const escrow = (r.escrow as Record<string, unknown> | undefined) ?? {};
  const hash =
    (r.hash as string) ??
    (r.txHash as string) ??
    (r.transactionHash as string) ??
    (r.signedXdrHash as string) ??
    (escrow.txHash as string) ??
    (escrow.transactionHash as string) ??
    null;
  const contractId =
    (r.contractId as string) ??
    (r.escrowAddress as string) ??
    (r.contractAddress as string) ??
    (escrow.contractId as string) ??
    null;
  return { hash, contractId, raw: r };
}

export async function twApproveMilestone(
  contractId: string,
  milestoneIndex: number,
  approver: string
): Promise<{ unsignedXDR: string }> {
  const r = await tw<TWXDRResponse>("/escrow/single-release/approve-milestone", {
    contractId,
    milestoneIndex: String(milestoneIndex),
    approver,
  });
  return { unsignedXDR: pickXDR(r) };
}

export async function twChangeMilestoneStatus(
  contractId: string,
  milestoneIndex: number,
  newStatus: "Completed" | "Pending",
  serviceProvider: string,
  newEvidence = "tilt heartbeat"
): Promise<{ unsignedXDR: string }> {
  const r = await tw<TWXDRResponse>(
    "/escrow/single-release/change-milestone-status",
    {
      contractId,
      milestoneIndex: String(milestoneIndex),
      newEvidence,
      newStatus,
      serviceProvider,
    }
  );
  return { unsignedXDR: pickXDR(r) };
}

export async function twReleaseFunds(
  contractId: string,
  releaseSigner: string
): Promise<{ unsignedXDR: string }> {
  const r = await tw<TWXDRResponse>("/escrow/single-release/release-funds", {
    contractId,
    releaseSigner,
  });
  return { unsignedXDR: pickXDR(r) };
}

export async function twResolveDispute(
  contractId: string,
  disputeResolver: string,
  distributions: Array<{ address: string; amount: number }>
): Promise<{ unsignedXDR: string }> {
  const r = await tw<TWXDRResponse>("/escrow/single-release/resolve-dispute", {
    contractId,
    disputeResolver,
    distributions,
  });
  return { unsignedXDR: pickXDR(r) };
}

/**
 * Open a dispute on the escrow — prerequisite for resolve-dispute. The TW
 * single-release contract treats the happy path (change-milestone-status →
 * approve-milestone → release-funds) and the dispute path (dispute-escrow →
 * resolve-dispute) as mutually exclusive. To route funds with custom
 * distributions, you must take the dispute path from the start.
 *
 * Idempotent: if the escrow is already in dispute (e.g. a previous attempt
 * succeeded the open but failed the resolve step), this returns
 * `alreadyInDispute = true` so the caller can proceed straight to resolve.
 */
export async function twDisputeEscrow(
  contractId: string,
  signer: string
): Promise<{ unsignedXDR: string | null; alreadyInDispute: boolean }> {
  try {
    const r = await tw<TWXDRResponse>("/escrow/single-release/dispute-escrow", {
      contractId,
      signer,
    });
    return { unsignedXDR: pickXDR(r), alreadyInDispute: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/already in dispute/i.test(msg)) {
      return { unsignedXDR: null, alreadyInDispute: true };
    }
    throw e;
  }
}

// ── commission padding ─────────────────────────────────────────────────────

// Re-exported from tw-fee for the server side. Client components should import
// from "@/lib/tw-fee" directly so they don't pull in the REST wrapper module.
export { TW_COMMISSION_RATE, grossWithTwFee } from "./tw-fee";

// ── escrow balance lookup ──────────────────────────────────────────────────

export type TWEscrow = {
  contractId: string;
  /**
   * Distributable balance after TW's 0.3% protocol fee. resolve-dispute
   * requires sum(distributions.amount) == balance exactly, so we always use
   * this number at settle time rather than computing it.
   */
  balance: number;
} & Record<string, unknown>;

/**
 * GET /helper/get-escrow-by-contract-ids
 *
 * NOTE: this hits the TW indexer, which lags the chain. The `balance` field
 * here can read 0 for an escrow that's actually funded — use
 * `twGetEscrowBalance` below for the live on-chain figure. Kept here for
 * future use if we ever need the full escrow metadata (milestones, roles).
 */
export async function twGetEscrowsByContractIds(
  contractIds: string[]
): Promise<TWEscrow[]> {
  if (contractIds.length === 0) return [];
  const q = [
    ...contractIds.map((id) => `contractIds[]=${encodeURIComponent(id)}`),
    "validateOnChain=true",
  ].join("&");
  const res = await fetch(
    `${BASE_URL}/helper/get-escrow-by-contract-ids?${q}`,
    {
      method: "GET",
      headers: { "x-api-key": apiKey() },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `TW /helper/get-escrow-by-contract-ids → ${res.status}: ${await res.text()}`
    );
  }
  return normaliseEscrowList((await res.json()) as unknown);
}

/**
 * GET /helper/get-multiple-escrow-balance
 *
 * Reads on-chain USDC balance held by escrow contract addresses. Param name
 * is `addresses` (the contract IDs ARE the addresses for Soroban). This is
 * what resolve-dispute's sum check is gated on — use this number, not the
 * indexer's `balance` field which can return 0 for freshly-funded escrows.
 *
 * Returns map { contractId → balance }. Missing contracts get 0.
 */
export async function twGetEscrowBalance(contractId: string): Promise<number> {
  const q = `addresses[]=${encodeURIComponent(contractId)}`;
  const res = await fetch(
    `${BASE_URL}/helper/get-multiple-escrow-balance?${q}`,
    {
      method: "GET",
      headers: { "x-api-key": apiKey() },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `TW /helper/get-multiple-escrow-balance → ${res.status}: ${await res.text()}`
    );
  }
  const body = (await res.json()) as unknown;
  const list = Array.isArray(body)
    ? body
    : (body as { data?: unknown[] })?.data ?? [];
  for (const row of list as Array<Record<string, unknown>>) {
    if (row.address === contractId && typeof row.balance === "number") {
      return row.balance;
    }
  }
  throw new Error(
    `TW get-multiple-escrow-balance returned no row for ${contractId}: ${JSON.stringify(body).slice(0, 300)}`
  );
}

function normaliseEscrowList(body: unknown): TWEscrow[] {
  if (Array.isArray(body)) return body as TWEscrow[];
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    if (Array.isArray(rec.escrows)) return rec.escrows as TWEscrow[];
    if (Array.isArray(rec.data)) return rec.data as TWEscrow[];
    if (Array.isArray(rec.result)) return rec.result as TWEscrow[];
    if (typeof rec.contractId === "string") return [rec as TWEscrow];
  }
  throw new Error(
    `TW get-escrow returned an unrecognised shape: ${JSON.stringify(body).slice(0, 200)}`
  );
}

// ── milestone planning helper ──────────────────────────────────────────────

/** One milestone per minute. Single-release escrow holds one total amount. */
export function planMilestones(durationSec: number): TWMilestoneInput[] {
  const minutes = Math.max(1, Math.floor(durationSec / 60));
  return Array.from({ length: minutes }, (_, i) => ({
    description: `minute ${i + 1}`,
  }));
}
