"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useListingViews } from "./ListingViewsProvider";
import { useApp } from "./AppProvider";
import { listingLikeId } from "@/lib/listing-likes.mjs";
import { initialListingViews } from "@/lib/listing-views.mjs";

export default function ListingViews({ listingId, record = false }) {
  const store = useListingViews(), id = listingLikeId(listingId), app = useApp();
  const subscribe = useCallback(fn => id && store ? store.subscribe(id, fn) : () => {}, [id, store]);
  const snapshot = useCallback(() => id && store ? store.get(id) : initialListingViews, [id, store]);
  const state = useSyncExternalStore(subscribe, snapshot, () => initialListingViews);
  useEffect(() => {
    if (!record || !id || !store || app?.online === false) return;
    const count = () => { if (document.visibilityState === "visible") store.record(id); };
    // Provider activation completes before counting, including on reconnect.
    const timer = setTimeout(count, 0);
    document.addEventListener("visibilitychange", count);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", count); };
  }, [id, record, store, app?.online]);
  if (!id) return null;
  const count = state.count === null ? "—" : BigInt(state.count).toLocaleString("en-PH");
  return <span className="listing-views" title={state.error ? "View count is temporarily unavailable. Refresh to check."
    : "One item view per browser per day. Counts begin when the item counter is enabled."}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
    {count} {state.count === "1" ? "view" : "views"}
    {state.count === null && <span className="sr-only"> — {state.error ? "count unavailable" : "loading count"}</span>}
  </span>;
}
