"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { createAdminAttentionStore, emptyAdminAttention, readAdminAttention } from "@/lib/admin-attention.mjs";

export default function useAdminAttention({ userId, isAdmin, online }) {
  const store = useMemo(() => createAdminAttentionStore(signal => readAdminAttention(supabase, { signal })), [userId]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, () => emptyAdminAttention);
  useEffect(() => {
    store.activate(Boolean(userId && isAdmin && online));
    const refresh = () => { if (document.visibilityState === "visible") void store.refresh(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); store.activate(false); };
  }, [store, userId, isAdmin, online]);
  return { adminAttention: state, refreshAdminAttention: store.refresh };
}
