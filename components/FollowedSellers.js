"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { supabase } from "@/lib/supabase";
import { announceSellerChange, communityError, communityRequest, sellerUrl } from "@/lib/seller-community.mjs";

export default function FollowedSellers() {
  const app = useApp();
  return <FollowingList key={app?.user?.id || "guest"} />;
}

function FollowingList() {
  const app = useApp(), user = app?.user;
  const [sellers, setSellers] = useState([]), [loading, setLoading] = useState(true), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(null);
  const lock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!user) return;
    let cancelled = false, revision = 0;
    async function load() {
      const current = ++revision; setLoading(true); setMessage("");
      try { const rows = await communityRequest(supabase.rpc("marketplace_followed_sellers")); if (!cancelled && current===revision) setSellers(rows || []); }
      catch (error) { if (!cancelled && current===revision) setMessage(communityError(error)); }
      finally { if (!cancelled && current===revision) setLoading(false); }
    }
    load(); window.addEventListener("marketplace-seller-change", load);
    return () => { cancelled = true; window.removeEventListener("marketplace-seller-change", load); };
  }, [user?.id]);

  async function unfollow(sellerId) {
    if (lock.current || !user || app?.online===false) return;
    lock.current = true; setBusy(sellerId); setMessage("");
    try {
      await communityRequest(supabase.rpc("set_marketplace_seller_follow", { p_seller_id: sellerId, p_follow: false }));
      if (!mounted.current) return;
      setSellers(rows => rows.filter(row => row.id !== sellerId)); announceSellerChange(sellerId);
    } catch (error) { if (mounted.current) setMessage(communityError(error)); }
    finally { lock.current = false; if (mounted.current) setBusy(null); }
  }

  return <section className="followed-sellers" aria-labelledby="followed-sellers-title">
    <p className="eyebrow">YOUR SELLERS</p><h2 id="followed-sellers-title">Sellers you follow</h2>
    {!app?.authReady ? <p>Checking sign-in…</p> : !user ? <Link href="/login">Sign in to view sellers you follow</Link> : loading ? <p>Loading followed sellers…</p> : sellers.length ?
      <div className="followed-seller-list">{sellers.map(seller => <article key={seller.id}>
        <div><Link href={sellerUrl(seller.id) || "/search"}><strong>{seller.username}</strong></Link>
          {seller.active_listing_count != null && <p>{seller.active_listing_count} active listings · {seller.recommendation_count} recommendations</p>}</div>
        <button className="seller-follow-button" type="button" disabled={busy!==null || app?.online===false} onClick={() => unfollow(seller.id)}>{busy===seller.id ? "Saving…" : "Unfollow seller"}</button>
      </article>)}</div> : !message && <p>Follow a seller from any of their listings to find them here.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
