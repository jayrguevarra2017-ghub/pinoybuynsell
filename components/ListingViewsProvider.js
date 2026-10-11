"use client";
import { createContext, useContext, useEffect, useMemo } from "react";
import { createListingViewsStore, listingViewsRPC } from "@/lib/listing-views.mjs";
import { visitorToken } from "@/lib/visitor-counter.mjs";

const ViewsContext = createContext(null);
export const useListingViews = () => useContext(ViewsContext);

export default function ListingViewsProvider({ children, online }) {
  const store = useMemo(() => {
    let visitor;
    const options = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, publicKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
    return createListingViewsStore({
      read: ids => listingViewsRPC("marketplace_listing_view_counts", { p_listing_ids: ids }, options),
      record: id => {
        if (!visitor) {
          let storage; try { storage = window.localStorage; } catch { /* Keep a token in memory. */ }
          visitor = visitorToken(storage);
        }
        return listingViewsRPC("record_marketplace_listing_view", { p_listing_id: id, p_visitor: visitor }, options);
      }
    });
  }, []);
  useEffect(() => { store.activate(online); }, [store, online]);
  useEffect(() => {
    const focus = () => { if (document.visibilityState === "visible") store.refreshVisible(); };
    window.addEventListener("focus", focus);
    return () => { window.removeEventListener("focus", focus); store.dispose(); };
  }, [store]);
  return <ViewsContext.Provider value={store}>{children}</ViewsContext.Provider>;
}
