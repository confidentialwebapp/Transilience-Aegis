"use client";

import { createClient } from "@/lib/supabase/client";

export interface CurrentUser {
  id: string;
  email: string;
  tenantId: string | null;
  isAdmin: boolean;
}

const ADMIN_ALLOWLIST_DEFAULT = "fde@transilienceai.com";

function adminAllowlist(): string[] {
  const v = process.env.NEXT_PUBLIC_ADMIN_ALLOWLIST_EMAILS ?? ADMIN_ALLOWLIST_DEFAULT;
  return v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** Resolve the current user once. Reads Supabase session, parses tenant_id from
 *  app_metadata, queries admin_users for admin status. Returns null if no session. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const u = session.user;
  const meta = (u.app_metadata ?? {}) as Record<string, unknown>;
  const tenantClaim = (meta["tenant_id"] as string | undefined) ?? null;

  let isAdmin = false;
  // 1. DB membership in admin_users
  const { data: row } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", u.id)
    .maybeSingle();
  if (row) isAdmin = true;

  // 2. Email allowlist fallback (handy before the DB row exists)
  const email = (u.email ?? "").toLowerCase();
  if (!isAdmin && email && adminAllowlist().includes(email)) {
    isAdmin = true;
  }

  return {
    id: u.id,
    email: u.email ?? "",
    tenantId: tenantClaim,
    isAdmin,
  };
}

/** Throws an Error if the current user isn't admin. Designed for use in admin
 *  layouts; the layout should catch and redirect to a denied screen. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("not_authenticated");
  if (!user.isAdmin) throw new Error("not_admin");
  return user;
}

/** Update a user's app_metadata.tenant_id. MUST run server-side with the service
 *  role key — do not call from a browser. Use from server actions / admin API
 *  routes only. */
export async function setTenantId(
  serviceRoleClient: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string
): Promise<void> {
  // Casting because the standard client doesn't expose admin.* without service role
  const admin = (serviceRoleClient as unknown as { auth: { admin: { updateUserById: (id: string, attrs: Record<string, unknown>) => Promise<{ error: unknown }> } } }).auth.admin;
  const { error } = await admin.updateUserById(userId, {
    app_metadata: { tenant_id: tenantId },
  });
  if (error) throw error;
}
