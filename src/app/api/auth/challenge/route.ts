import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { issueChallenge } from "@/lib/wallet-session";
import { clientIp } from "@/lib/client-ip";

export async function POST(req: NextRequest) {
  const { address } = (await req.json()) as { address: string };
  if (!address || typeof address !== "string") {
    return NextResponse.json({ error: "missing address" }, { status: 400 });
  }
  const ip = clientIp(await headers());
  const ch = await issueChallenge(address, ip);
  return NextResponse.json(ch);
}
