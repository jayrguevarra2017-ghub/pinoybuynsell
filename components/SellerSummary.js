"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { supabase } from "@/lib/supabase";
import { announceSellerChange, communityError, communityRequest, sellerUrl } from "@/lib/seller-community.mjs";

export default function SellerSummary({ sellerId, profile: suppliedProfile, onChange }) {
  const app = useApp();
  const [loaded, setLoaded] = useState(null), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const lock = useRef(false);
  const user = app?.user;
  const profile = suppliedProfile === undefined ? loaded : suppliedProfile;
  const href = sellerUrl(sellerId);

  useEffect(() => {
    if (suppliedProfile !== undefined || !href) return;
    let cancelled = false, version = 0;
    async function load() {
      const current = ++version; setLoading(true); setMessage(""); setLoaded(null);
      try {
        const data = await communityRequest(supabase.rpc("marketplace_seller_profile", { p_seller_id: sellerId }));
        if (!cancelled && current === version) setLoaded(data);
      } catch (error) { if (!cancelled && current === version) setMessage(communityError(error)); }
      finally { if (!cancelled && current === version) setLoading(false); }
    }
    load();
    const changed = event => { if (event.detail === sellerId) load(); };
    window.addEventListener("marketplace-seller-change", changed);
    return () => { cancelled = true; window.removeEventListener("marketplace-seller-change", changed); };
  }, [sellerId, href, suppliedProfile, user?.id]);

  async function follow() {
    if (lock.current || !user || !profile || user.id === sellerId) return;
    if (app?.online === false) { setMessage("Reconnect to follow or unfollow a seller."); return; }
    lock.current = true; setBusy(true); setMessage("");
    try {
      const data = await communityRequest(supabase.rpc("set_marketplace_seller_follow", { p_seller_id: sellerId, p_follow: !profile.following }));
      setLoaded(data); onChange?.(data); announceSellerChange(sellerId);
      setMessage(profile.following ? "Seller unfollowed." : "You are now following this seller.");
    } catch (error) { setMessage(communityError(error)); }
    finally { lock.current = false; setBusy(false); }
  }

  if (!href) return null;
  const pending = suppliedProfile === undefined && loading;
  return <section className="seller-summary" aria-label="Seller">
    <div className="seller-summary-top">
      <div className="seller-avatar" aria-hidden="true">{(profile?.username || "S").slice(0,1).toUpperCase()}</div>
      <div className="seller-summary-name"><span className="eyebrow">SELLER</span>
        <Link href={href}>{profile?.username || "View seller profile"}</Link>
        {profile && <p>{Number(profile.follower_count || 0).toLocaleString("en-PH")} {Number(profile.follower_count) === 1 ? "follower" : "followers"} · {Number(profile.recommendation_count || 0).toLocaleString("en-PH")} {Number(profile.recommendation_count) === 1 ? "recommendation" : "recommendations"}</p>}
      </div>
      {profile && app?.authReady && (user?.id === sellerId ? <span className="seller-own-label">Your profile</span> : user ?
        <button className="seller-follow-button" type="button" aria-pressed={Boolean(profile.following)} disabled={busy || app?.online === false} onClick={follow}>
          {busy ? "Saving…" : profile.following ? "Unfollow seller" : "+ Follow seller"}</button> :
        <Link className="seller-follow-button" href="/login">Sign in to follow</Link>)}
    </div>
    {pending && <p className="muted">Loading seller…</p>}
    {!pending && !profile && !message && <p className="muted">Seller profile is unavailable.</p>}
    {message && <p role="status">{message}</p>}
    {profile && <Link className="seller-profile-link" href={href}>Seller’s listings and recommendations →</Link>}
  </section>;
}
