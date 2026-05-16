import { NextResponse } from "next/server";
import { readSession } from "@/lib/wallet-session";
import { isAdmin } from "@/lib/admin-auth";

/** Cheap probe so the admin UI can decide whether to render itself. */
export async function GET() {
  const sess = await readSession();
  if (!sess) return NextResponse.json({ admin: false, reason: "unauthenticated" });
  return NextResponse.json({
    admin: isAdmin(sess.address),
    address: sess.address,
  });
}
