import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { readSession } from "@/lib/wallet-session";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await readSession();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const svc = getServiceClient();
  const { data: listing } = await svc.from("listings").select("*").eq("id", id).single();
  if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });
  return NextResponse.json({ listing });
}
