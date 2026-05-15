import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { readSession } from "@/lib/wallet-session";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await readSession();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const svc = getServiceClient();
  const { data: vault } = await svc
    .from("vaults")
    .select("provider_wallet, kill_active")
    .eq("id", id)
    .single();
  if (!vault || vault.provider_wallet !== auth.address) {
    return NextResponse.json({ error: "not your vault" }, { status: 403 });
  }

  const next = !vault.kill_active;
  await svc.from("vaults").update({ kill_active: next }).eq("id", id);

  return NextResponse.json({ kill_active: next });
}
