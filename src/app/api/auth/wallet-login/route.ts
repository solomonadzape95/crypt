import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import {
  consumeChallenge,
  issueSession,
  verifyStellarSignature,
} from "@/lib/wallet-session";
import { clientIp } from "@/lib/client-ip";
import { getServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const { address, signatureB64 } = (await req.json()) as {
    address: string;
    signatureB64: string;
  };
  if (!address || !signatureB64) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const ip = clientIp(await headers());
  const ch = await consumeChallenge(address, ip);
  if (!ch) {
    return NextResponse.json(
      { error: "no challenge in flight; request a new one" },
      { status: 400 }
    );
  }

  const result = verifyStellarSignature(address, ch.message, signatureB64);
  console.log("[wallet-login] verify", {
    address,
    sigPreview: `${signatureB64.slice(0, 24)}…(${signatureB64.length} chars)`,
    messageBytes: Buffer.byteLength(ch.message, "utf8"),
    tried: result.tried,
    matched: result.matched,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: "invalid signature",
        tried: result.tried,
        sigChars: signatureB64.length,
        sigPreview: `${signatureB64.slice(0, 16)}…${signatureB64.slice(-8)}`,
        messageBytes: Buffer.byteLength(ch.message, "utf8"),
        addressLen: address.length,
      },
      { status: 401 }
    );
  }

  await issueSession(address);

  // Upsert into users so we have a discoverable record of who's signed in.
  // Bumps last_seen_at on every login. Auth itself is still cookie-only —
  // this table is metadata, not an auth source.
  try {
    const wallet = address.toUpperCase();
    await getServiceClient()
      .from("users")
      .upsert(
        { wallet, last_seen_at: new Date().toISOString() },
        { onConflict: "wallet" },
      );
  } catch (e) {
    // Non-fatal — the session is already issued, the user can use the app
    // even if the user-row write fails (e.g. migration not applied yet).
    console.warn("[wallet-login] users upsert failed:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: true, address: address.toUpperCase(), matched: result.matched });
}
