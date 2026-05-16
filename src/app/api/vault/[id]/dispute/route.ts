import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { readSession } from "@/lib/wallet-session";

const MIN_EVIDENCE_LEN = 10;
const MAX_EVIDENCE_LEN = 2000;

/**
 * Provider opens a dispute against a pending breach. Idempotent — once a vault
 * is in_review the call is a no-op (returns the existing record). The dispute
 * window is enforced server-side: requests after `dispute_window_ends_at`
 * are rejected with 410 (gone).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await readSession();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { evidence?: string };
  const evidence = (body.evidence ?? "").trim();
  if (evidence.length < MIN_EVIDENCE_LEN || evidence.length > MAX_EVIDENCE_LEN) {
    return NextResponse.json(
      { error: `evidence must be ${MIN_EVIDENCE_LEN}–${MAX_EVIDENCE_LEN} characters` },
      { status: 400 }
    );
  }

  const svc = getServiceClient();
  const { data: vault } = await svc.from("vaults").select("*").eq("id", id).single();
  if (!vault) return NextResponse.json({ error: "vault not found" }, { status: 404 });
  if (vault.provider_wallet !== auth.address) {
    return NextResponse.json({ error: "only the provider can dispute" }, { status: 403 });
  }
  if (vault.dispute_status === "in_review") {
    return NextResponse.json({ ok: true, dispute_status: "in_review" });
  }
  if (vault.dispute_status !== "pending") {
    return NextResponse.json(
      { error: `nothing to dispute (current dispute_status=${vault.dispute_status})` },
      { status: 409 }
    );
  }
  if (vault.dispute_window_ends_at && new Date(vault.dispute_window_ends_at) < new Date()) {
    return NextResponse.json({ error: "dispute window has closed" }, { status: 410 });
  }

  // Conditional UPDATE so a slow second click after the cron has already
  // settled can't reopen.
  const { data: updated, error } = await svc
    .from("vaults")
    .update({
      dispute_status: "in_review",
      dispute_evidence: evidence,
      dispute_opened_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("dispute_status", "pending")
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "dispute window already closed or settled" },
      { status: 410 }
    );
  }
  return NextResponse.json({ ok: true, dispute_status: "in_review" });
}
