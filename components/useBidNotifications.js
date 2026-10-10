"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { createBidNoticeStore, emptyBidNotices, requestBidNotices } from "@/lib/bid-notices.mjs";

export default function useBidNotifications({ userId, online }) {
  const store = useMemo(() => createBidNoticeStore({
    read: signal => requestBidNotices(supabase, userId, { signal }),
    mark: (ids, signal) => requestBidNotices(supabase, userId, { ids, signal }),
  }), [userId]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, () => emptyBidNotices);
  useEffect(() => {
    store.activate(Boolean(userId && online));
    const refresh = () => { if (document.visibilityState === "visible") void store.refresh(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); store.activate(false); };
  }, [store, userId, online]);
  return { bidNotifications: state, refreshBidNotifications: store.refresh, markBidNotificationsRead: store.markRead, dismissBidNotification: store.dismiss };
}
