"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_ALLOWLIST = "fde@transilienceai.com";

function getAllowlist(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_ALLOWLIST_EMAILS ?? DEFAULT_ALLOWLIST;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export interface AdminCheck {
  isAdmin: boolean;
  loading: boolean;
  email: string | null;
  userId: string | null;
}

export function useAdminCheck(): AdminCheck {
  const [state, setState] = useState<AdminCheck>({
    isAdmin: false,
    loading: true,
    email: null,
    userId: null,
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session?.user) {
          if (!cancelled) {
            setState({ isAdmin: false, loading: false, email: null, userId: null });
          }
          return;
        }
        const email = (session.user.email ?? "").toLowerCase();
        const userId = session.user.id;
        const allowlist = getAllowlist();
        let isAdmin = email && allowlist.includes(email) ? true : false;

        if (!isAdmin) {
          const { data: rows } = await supabase
            .from("admin_users")
            .select("user_id")
            .eq("user_id", userId)
            .limit(1);
          if (rows && rows.length > 0) isAdmin = true;
        }

        if (!cancelled) {
          setState({ isAdmin, loading: false, email, userId });
        }
      } catch {
        if (!cancelled) {
          setState({ isAdmin: false, loading: false, email: null, userId: null });
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// Used by sidebar to conditionally render admin links without an extra fetch.
// Best-effort: returns true if there's a cached admin marker; false otherwise.
export function isLikelyAdminFromCache(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("tai_is_admin") === "1";
  } catch {
    return false;
  }
}

export function setAdminCache(isAdmin: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("tai_is_admin", isAdmin ? "1" : "0");
  } catch {}
}
