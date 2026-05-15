import { NextResponse } from "next/server";
import { readSession } from "@/lib/wallet-session";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ authenticated: false }, { status: 200 });
  return NextResponse.json({ authenticated: true, address: session.address });
}
