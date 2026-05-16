import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { readSession } from "@/lib/wallet-session";

/**
 * Demo heartbeat — a fake "API" providers can paste into a listing's
 * apiUrl during prod walkthroughs. Behaviour:
 *
 *   GET  /api/demo/heartbeat  → 200 when alive, 503 when killed.
 *   POST /api/demo/heartbeat  → flip the alive flag (auth required).
 *                                Body: { alive: boolean } or no body to toggle.
 *
 * State lives in `demo_state` so toggles from one lambda are visible to
 * the next oracle tick from a different lambda. Polling rate is whatever
 * the vault's check interval is — same path the oracle hits for any URL.
 *
 * Cache-Control: no-store on every response so CDNs / browsers don't
 * mask a freshly-killed state.
 */

const KEY = "heartbeat";

async function getAlive(): Promise<boolean> {
  const svc = getServiceClient();
  const { data } = await svc
    .from("demo_state")
    .select("alive")
    .eq("key", KEY)
    .maybeSingle();
  // Default to alive if the row hasn't been seeded yet (migration not applied).
  return data?.alive ?? true;
}

async function setAlive(alive: boolean): Promise<void> {
  const svc = getServiceClient();
  await svc
    .from("demo_state")
    .upsert(
      { key: KEY, alive, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
}

export async function GET() {
  const alive = await getAlive().catch(() => true);
  const body = {
    service: "crypt demo heartbeat",
    alive,
    ts: new Date().toISOString(),
  };
  if (!alive) {
    return NextResponse.json(
      { ...body, error: "demo heartbeat is killed" },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "sign in first" }, { status: 401 });
  }

  let nextAlive: boolean;
  try {
    const body = (await req.json().catch(() => ({}))) as { alive?: boolean };
    if (typeof body.alive === "boolean") {
      nextAlive = body.alive;
    } else {
      nextAlive = !(await getAlive());
    }
  } catch {
    nextAlive = !(await getAlive());
  }

  await setAlive(nextAlive);
  return NextResponse.json(
    { alive: nextAlive, by: session.address, ts: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
