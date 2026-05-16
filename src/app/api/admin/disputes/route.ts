import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const svc = getServiceClient();
  const { data, error } = await svc
    .from("vaults")
    .select("*")
    .eq("dispute_status", "in_review")
    .order("dispute_opened_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vaults: data ?? [] });
}
