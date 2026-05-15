import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { Keypair, hash } from "@stellar/stellar-sdk";

const SESSION_COOKIE = "crypt_session";
const CHALLENGE_COOKIE = "crypt_challenge";
const SESSION_DAYS = 7;
const CHALLENGE_MINUTES = 5;

function secretBytes(): Uint8Array {
  const s = process.env.CRYPT_SESSION_SECRET;
  if (!s) throw new Error("CRYPT_SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

// ── Challenge ──────────────────────────────────────────────────────────────

export type Challenge = { nonce: string; message: string };

export function challengeMessage(address: string, nonce: string): string {
  // IMPORTANT: must be deterministic from (address, nonce) so the bytes we
  // verify match the bytes Freighter signed. Do not add timestamps here.
  return [
    "crypt — sign in with your Stellar wallet.",
    "",
    `Address: ${address.toUpperCase()}`,
    `Nonce: ${nonce}`,
    "",
    "This signature proves you control the address. It will not send a transaction.",
  ].join("\n");
}

export async function issueChallenge(address: string): Promise<Challenge> {
  const nonce = crypto.randomUUID();
  const jwt = await new SignJWT({ addr: address.toUpperCase(), nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${CHALLENGE_MINUTES}m`)
    .sign(secretBytes());
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_MINUTES * 60,
    secure: process.env.NODE_ENV === "production",
  });
  return { nonce, message: challengeMessage(address, nonce) };
}

export async function consumeChallenge(
  address: string,
): Promise<{ nonce: string; message: string } | null> {
  const store = await cookies();
  const jwt = store.get(CHALLENGE_COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secretBytes());
    if (typeof payload.addr !== "string" || typeof payload.nonce !== "string")
      return null;
    if (payload.addr !== address.toUpperCase()) return null;
    // Single-use
    store.delete(CHALLENGE_COOKIE);
    return {
      nonce: payload.nonce,
      message: challengeMessage(address, payload.nonce),
    };
  } catch {
    return null;
  }
}

// ── Session ────────────────────────────────────────────────────────────────

export type WalletSession = { address: string };

export async function issueSession(address: string): Promise<void> {
  const jwt = await new SignJWT({ addr: address.toUpperCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretBytes());
  const store = await cookies();
  store.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<WalletSession | null> {
  const store = await cookies();
  const jwt = store.get(SESSION_COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secretBytes());
    if (typeof payload.addr !== "string") return null;
    return { address: payload.addr };
  } catch {
    return null;
  }
}

// Edge-compatible variant for the proxy (no `cookies()` helper there).
export async function readSessionFromCookieString(
  cookieValue: string | undefined,
): Promise<WalletSession | null> {
  if (!cookieValue) return null;
  try {
    const { payload } = await jwtVerify(cookieValue, secretBytes());
    if (typeof payload.addr !== "string") return null;
    return { address: payload.addr };
  } catch {
    return null;
  }
}

// ── Signature verification ────────────────────────────────────────────────

/**
 * Verify a Stellar Ed25519 signature over a message. Tries several encodings
 * because Freighter has shipped different formats across versions.
 */
export function verifyStellarSignature(
  address: string,
  message: string,
  signature: string,
): { ok: boolean; tried: string[]; matched: string | null } {
  const kp = (() => {
    try {
      return Keypair.fromPublicKey(address);
    } catch {
      return null;
    }
  })();
  if (!kp) return { ok: false, tried: ["address-parse"], matched: null };

  const raw = Buffer.from(message, "utf8");
  const sha = Buffer.from(hash(raw));
  const sep43Prefix = Buffer.from("Stellar Signed Message:\n", "utf8");
  const sep43 = Buffer.from(hash(Buffer.concat([sep43Prefix, raw])));

  const sigBytes = (() => {
    const b = safe(() => Buffer.from(signature, "base64"));
    if (b && b.length === 64) return b;
    const h = safe(() => Buffer.from(signature.replace(/^0x/, ""), "hex"));
    if (h && h.length === 64) return h;
    return null;
  })();

  if (!sigBytes) {
    return {
      ok: false,
      tried: [`bad-sig-decode(chars=${signature.length})`],
      matched: null,
    };
  }

  const variants: Array<{ name: string; bytes: Buffer }> = [
    { name: "raw-message", bytes: raw },
    { name: "sha256(message)", bytes: sha },
    { name: "sha256(SEP43-prefix+message)", bytes: sep43 },
  ];

  const tried: string[] = [];
  for (const v of variants) {
    try {
      if (kp.verify(v.bytes, sigBytes))
        return { ok: true, tried, matched: v.name };
      tried.push(v.name);
    } catch (e) {
      tried.push(`${v.name}-throw`);
    }
  }
  return { ok: false, tried, matched: null };
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
