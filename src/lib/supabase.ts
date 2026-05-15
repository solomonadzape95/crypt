import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseReady = Boolean(url && anon);

/**
 * Browser-side Postgres + Realtime client. Used for *reads only* — every
 * write goes through an API route so the wallet-session cookie can authorise it.
 */
export function getBrowserClient() {
  if (!url || !anon) {
    throw new Error("Supabase env not set. Add NEXT_PUBLIC_SUPABASE_* to .env.local.");
  }
  return createClient(url, anon, { auth: { persistSession: false } });
}
