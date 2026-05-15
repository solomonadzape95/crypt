import { NextResponse, type NextRequest } from "next/server";
import {
  consumeChallenge,
  issueSession,
  verifyStellarSignature,
} from "@/lib/wallet-session";

export async function POST(req: NextRequest) {
  const { address, signatureB64 } = (await req.json()) as {
    address: string;
    signatureB64: string;
  };
  if (!address || !signatureB64) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const ch = await consumeChallenge(address);
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
  return NextResponse.json({ ok: true, address: address.toUpperCase(), matched: result.matched });
}
