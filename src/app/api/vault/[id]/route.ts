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
  const { data: vault } = await svc.from("vaults").select("*").eq("id", id).single();
  if (!vault) return NextResponse.json({ error: "vault not found" }, { status: 404 });

  const { data: checks } = await svc
    .from("checks")
    .select("*")
    .eq("vault_id", id)
    .order("ts", { ascending: false })
    .limit(50);

  return NextResponse.json({ vault, checks: checks ?? [] });
}
