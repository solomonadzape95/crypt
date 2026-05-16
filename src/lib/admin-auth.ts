import { NextResponse } from "next/server";
import { readSession } from "./wallet-session";

/**
 * Admin auth — gates the dispute review surface and any other ops-only route.
 * Allowlist comes from `ADMIN_WALLETS` (comma-separated Stellar G-addresses).
 */

function adminWallets(): Set<string> {
  const raw = process.env.ADMIN_WALLETS ?? "";
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const v = part.trim().toUpperCase();
    if (v) set.add(v);
  }
  return set;
}

export function isAdmin(address: string | null | undefined): boolean {
  if (!address) return false;
  return adminWallets().has(address.toUpperCase());
}

export async function requireAdmin(): Promise<
  { ok: true; address: string } | { ok: false; res: NextResponse }
> {
  const sess = await readSession();
  if (!sess) {
    return {
      ok: false,
      res: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }
  if (!isAdmin(sess.address)) {
    return {
      ok: false,
      res: NextResponse.json({ error: "not an admin wallet" }, { status: 403 }),
    };
  }
  return { ok: true, address: sess.address.toUpperCase() };
}
