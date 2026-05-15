import {
  Asset,
  Keypair,
  Networks,
  TransactionBuilder,
  Horizon,
} from "@stellar/stellar-sdk";

export const STELLAR_NETWORK = Networks.TESTNET;
export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

export const USDC_ISSUER =
  process.env.NEXT_PUBLIC_USDC_ISSUER ??
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export const USDC = new Asset("USDC", USDC_ISSUER);

export const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_STELLAR_EXPLORER ??
  "https://stellar.expert/explorer/testnet";

export const horizon = new Horizon.Server(HORIZON_URL);

export function explorerTxUrl(hash: string) {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

export function explorerContractUrl(contractId: string) {
  return `${EXPLORER_BASE}/contract/${contractId}`;
}

// ── platform signers ───────────────────────────────────────────────────────
// Two keypairs:
//   • platform — holds approver, serviceProvider, releaseSigner, receiver.
//                Signs deploy / fund / change-status / approve / release /
//                dispute-escrow. The "approver" role is what gives platform
//                permission to OPEN a dispute.
//   • resolver — holds disputeResolver only. Signs resolve-dispute. Lives in
//                its own slot so TW's role check doesn't see the disputer as
//                the resolver (which would refuse).
// Both need testnet XLM to pay tx fees; neither needs a USDC trustline.

let platformKeypair: Keypair | null = null;
let resolverKeypair: Keypair | null = null;

export function getPlatformSigner(): Keypair {
  if (platformKeypair) return platformKeypair;
  const secret = process.env.STELLAR_PLATFORM_SECRET;
  if (!secret) {
    throw new Error(
      "STELLAR_PLATFORM_SECRET is not set. Generate a testnet keypair and fund via friendbot."
    );
  }
  platformKeypair = Keypair.fromSecret(secret);
  return platformKeypair;
}

export function getPlatformPublic(): string {
  return process.env.STELLAR_PLATFORM_PUBLIC ?? getPlatformSigner().publicKey();
}

export function getResolverSigner(): Keypair {
  if (resolverKeypair) return resolverKeypair;
  const secret = process.env.STELLAR_RESOLVER_SECRET;
  if (!secret) {
    throw new Error(
      "STELLAR_RESOLVER_SECRET is not set. Generate a second testnet keypair (it holds only the disputeResolver role) and fund via friendbot. See SPEC.md."
    );
  }
  resolverKeypair = Keypair.fromSecret(secret);
  return resolverKeypair;
}

export function getResolverPublic(): string {
  return process.env.STELLAR_RESOLVER_PUBLIC ?? getResolverSigner().publicKey();
}

/**
 * Sign an XDR string with the platform key and return the new XDR.
 * The XDR is expected to be a TransactionEnvelope already prepared by Trustless Work.
 */
export function signWithPlatform(xdr: string): string {
  const tx = TransactionBuilder.fromXDR(xdr, STELLAR_NETWORK);
  tx.sign(getPlatformSigner());
  return tx.toXDR();
}

/** Sign an XDR with the resolver keypair — used only for resolve-dispute. */
export function signWithResolver(xdr: string): string {
  const tx = TransactionBuilder.fromXDR(xdr, STELLAR_NETWORK);
  tx.sign(getResolverSigner());
  return tx.toXDR();
}

/**
 * Submit a signed XDR to Horizon and return the resulting hash.
 *
 * On `tx_failed`, Horizon stuffs the actual cause into
 * `response.data.extras.result_codes` — the SDK by default re-throws an
 * Axios error that hides this. We extract the codes and rethrow a
 * normal Error whose `.message` carries the real diagnosis (tx code +
 * per-op codes), so logs and `vault.settle_error` are actually useful.
 */
export async function submitSigned(xdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(xdr, STELLAR_NETWORK);
  try {
    const result = await horizon.submitTransaction(tx);
    return result.hash;
  } catch (e) {
    const codes = extractHorizonCodes(e);
    if (codes) {
      const err = new Error(
        `Horizon /transactions → ${codes.status} ${codes.title}: tx=${codes.tx} ops=[${codes.ops.join(",")}]`
      );
      (err as Error & { horizon?: typeof codes }).horizon = codes;
      throw err;
    }
    throw e;
  }
}

/**
 * Pluck `extras.result_codes` + the headline title out of an Axios error
 * returned by Horizon. Returns null if it doesn't look like a Horizon
 * tx_failed response.
 */
function extractHorizonCodes(e: unknown): {
  status: number;
  title: string;
  tx: string;
  ops: string[];
} | null {
  if (!e || typeof e !== "object") return null;
  const resp = (e as { response?: { status?: number; data?: unknown } }).response;
  if (!resp?.data || typeof resp.data !== "object") return null;
  const data = resp.data as {
    title?: string;
    status?: number;
    extras?: { result_codes?: { transaction?: string; operations?: string[] } };
  };
  const rc = data.extras?.result_codes;
  if (!rc) return null;
  return {
    status: resp.status ?? data.status ?? 0,
    title: data.title ?? "Transaction Failed",
    tx: rc.transaction ?? "?",
    ops: Array.isArray(rc.operations) ? rc.operations : [],
  };
}
