import { NextResponse, type NextRequest } from "next/server";
import { issueChallenge } from "@/lib/wallet-session";

export async function POST(req: NextRequest) {
  const { address } = (await req.json()) as { address: string };
  if (!address || typeof address !== "string") {
    return NextResponse.json({ error: "missing address" }, { status: 400 });
  }
  const ch = await issueChallenge(address);
  return NextResponse.json(ch);
}
