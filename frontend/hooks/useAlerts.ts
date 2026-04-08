"use client";

import { useEffect, useState, useCallback } from "react";
import type { Alert } from "@/lib/api";

export function useAlerts(orgId: string) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!orgId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabaseInstance: any = null;

    const setupRealtime = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        supabaseInstance = createClient();

        channel = supabaseInstance
          .channel("alerts-realtime")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "alerts",
              filter: `org_id=eq.${orgId}`,
            },
            (payload: { new: Alert }) => {
              const newAlert = payload.new;
              setAlerts((prev) => [newAlert, ...prev].slice(0, 50));
              setUnreadCount((prev) => prev + 1);
            }
          )
          .subscribe((status: string) => {
            if (status === "CHANNEL_ERROR") {
              console.warn("Realtime subscription failed - alerts will not update in real-time");
            }
          });
      } catch {
        // Supabase not configured or network error - gracefully degrade
        console.warn("Unable to connect to realtime alerts.");
      }
    };

    setupRealtime();

    return () => {
      if (channel && supabaseInstance) {
        try {
          supabaseInstance.removeChannel(channel);
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [orgId]);

  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return { alerts, unreadCount, clearUnread };
}
