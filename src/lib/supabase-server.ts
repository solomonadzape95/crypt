import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Privileged Postgres client used by API routes. Bypasses RLS.
 * Auth is enforced by reading the signed wallet-session cookie, not by Supabase.
 */
export function getServiceClient() {
  if (!url || !service) throw new Error("Supabase service-role env not set");
  return createClient(url, service, { auth: { persistSession: false } });
}
