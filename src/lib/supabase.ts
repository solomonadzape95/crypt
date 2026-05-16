import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseReady = Boolean(url && anon);

let cached: SupabaseClient | null = null;

/**
 * Browser-side Postgres + Realtime client. Used for *reads only* — every
 * write goes through an API route so the wallet-session cookie can authorise it.
 *
 * Memoised so every call site shares one client per tab. Without the cache
 * each component that called this would spawn its own GoTrueClient against
 * the same storage key, which Supabase warns about and which would mean a
 * separate realtime websocket per consumer.
 */
export function getBrowserClient(): SupabaseClient {
  if (!url || !anon) {
    throw new Error("Supabase env not set. Add NEXT_PUBLIC_SUPABASE_* to .env.local.");
  }
  if (!cached) {
    cached = createClient(url, anon, { auth: { persistSession: false } });
  }
  return cached;
}
