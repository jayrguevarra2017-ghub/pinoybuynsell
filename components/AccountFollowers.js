"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "./AppProvider";
import { supabase } from "@/lib/supabase";
import { sellerUrl } from "@/lib/seller-community.mjs";
import { readSellerFollowerCount, followerCountError } from "@/lib/seller-follower-count.mjs";

export default function AccountFollowers({ sellerId }) {
  const app = useApp();
  const [count, setCount] = useState(null), [error, setError] = useState(false), [refreshing, setRefreshing] = useState(false);
  const [revision, setRevision] = useState(0), [updated, setUpdated] = useState(null);
  const online = app?.online !== false;
  useEffect(() => {
    if (!online) { setRefreshing(false); return; }
    let cancelled = false, running = false;
    const controller = new AbortController();
    async function load() {
      if (cancelled || running || document.visibilityState !== "visible") return;
      running = true; setRefreshing(true);
      try {
        const total = await readSellerFollowerCount(supabase, sellerId, { signal: controller.signal });
        if (!cancelled) { setCount(total); setError(false); setUpdated(Date.now()); }
      } catch { if (!cancelled) setError(true); }
      finally { running = false; if (!cancelled) setRefreshing(false); }
    }
    const changed = event => { if (event.detail === sellerId) load(); };
    load();
    const timer = setInterval(load, 10000);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    window.addEventListener("marketplace-seller-change", changed);
    return () => {
      cancelled = true; controller.abort(); clearInterval(timer);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener("marketplace-seller-change", changed);
    };
  }, [sellerId, online, revision]);

  return <section className="account-followers" aria-label="Your website followers">
    <div className="account-followers-total">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="9" cy="7" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6M17 13a5 5 0 0 1 4 5v2" /></svg>
      <div><span>Website followers</span><strong aria-live="polite" aria-atomic="true">{count === null ? "—" : count.toLocaleString("en-PH")}</strong></div>
    </div>
    <div className="account-followers-actions">
      <p>{!online ? "Reconnect to update your count." : error ? followerCountError : updated ? "Updates every 10 seconds while this page is visible." : "Checking your followers…"}</p>
      {updated && (error || !online) && <small>Last confirmed count shown.</small>}
      <div><button type="button" className="view inline" disabled={!online || refreshing} onClick={() => setRevision(value => value + 1)}>{refreshing ? "Refreshing…" : "Refresh followers"}</button>
        {sellerUrl(sellerId) && <Link className="view inline" href={sellerUrl(sellerId)}>View my seller profile</Link>}</div>
    </div>
  </section>;
}
