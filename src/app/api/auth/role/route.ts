import { NextResponse } from "next/server";
import { readSession } from "@/lib/wallet-session";
import { getServiceClient } from "@/lib/supabase-server";

/**
 * Resolves the signed-in wallet's role for nav purposes. Provider wins
 * as soon as they've ever listed anything; default subscriber otherwise.
 * Returns 200 with role=null when unauthenticated, so the FloatingNav
 * can stay silent rather than 401-spinning.
 */
export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { authenticated: false, role: null },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
  let role: "provider" | "subscriber" = "subscriber";
  try {
    const svc = getServiceClient();
    const { count } = await svc
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("provider_wallet", session.address);
    if ((count ?? 0) > 0) role = "provider";
  } catch {
    // Default subscriber on infra failure.
  }
  return NextResponse.json(
    { authenticated: true, address: session.address, role },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
