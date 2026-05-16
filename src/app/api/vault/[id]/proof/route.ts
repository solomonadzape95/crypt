import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

/**
 * Public, unauthenticated proof endpoint. Returns the vault row + the most
 * recent 200 checks. Vault metadata + checks data is intentionally non-private
 * — the whole point of this product is that the audit trail is shareable.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const svc = getServiceClient();
  const { data: vault, error: vErr } = await svc
    .from("vaults")
    .select("*")
    .eq("id", id)
    .single();
  if (vErr || !vault) {
    return NextResponse.json({ error: "vault not found" }, { status: 404 });
  }
  const { data: checks } = await svc
    .from("checks")
    .select("*")
    .eq("vault_id", id)
    .order("ts", { ascending: false })
    .limit(200);
  return NextResponse.json({ vault, checks: checks ?? [] });
}
