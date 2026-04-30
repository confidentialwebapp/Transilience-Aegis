import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Server-only Supabase client using the service role key. Bypasses RLS.
 *  Never import this from a client component — Next.js will throw at build
 *  time because of the SUPABASE_SERVICE_ROLE_KEY reference. */
export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
