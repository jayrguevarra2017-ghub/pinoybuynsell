"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { supabase } from "@/lib/supabase";
import { announceSellerChange, communityError, communityRequest, validateRecommendation } from "@/lib/seller-community.mjs";

export default function SellerRecommendations({ sellerId, profile, onChange }) {
  const app = useApp(), user = app?.user;
  const [items, setItems] = useState([]), [offset, setOffset] = useState(0), [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState(profile?.own_recommendation?.body || "");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [refresh, setRefresh] = useState(0);
  const lock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setDraft(profile?.own_recommendation?.body || ""); }, [profile?.own_recommendation?.body]);
  useEffect(() => {
    let cancelled = false; setLoading(true); setLoadError(""); setItems([]);
    communityRequest(supabase.rpc("marketplace_seller_recommendations", { p_seller_id: sellerId, p_offset: offset }))
      .then(data => { if (!cancelled) { const rows = Array.isArray(data) ? data : []; setItems(rows.slice(0,20)); setHasMore(rows.length > 20); } })
      .catch(error => { if (!cancelled) setLoadError(communityError(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sellerId, offset, refresh, user?.id]);

  async function save(event, remove = false) {
    event?.preventDefault();
    if (lock.current || !user || user.id === sellerId) return;
    if (app?.online === false) { setMessage("Reconnect before changing your recommendation."); return; }
    let body;
    try { if (!remove) body = validateRecommendation(draft); }
    catch (error) { setMessage(error.message); return; }
    lock.current = true; setBusy(true); setMessage("");
    try {
      const data = await communityRequest(supabase.rpc(remove ? "delete_marketplace_seller_recommendation" : "save_marketplace_seller_recommendation",
        { p_seller_id: sellerId, ...(!remove ? { p_body: body } : {}) }));
      if (!mounted.current) return;
      onChange(data); announceSellerChange(sellerId); setOffset(0); setRefresh(v => v + 1);
      setMessage(remove ? "Your recommendation was removed." : "Your recommendation was saved.");
    } catch (error) { if (mounted.current) setMessage(communityError(error)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  return <section className="seller-recommendations" aria-labelledby="seller-recommendations-title">
    <div className="section-head"><div><p className="eyebrow">FROM THE COMMUNITY</p>
      <h2 id="seller-recommendations-title">Customer recommendations</h2></div>
      {profile && <span className="seller-count">{Number(profile.recommendation_count || 0).toLocaleString("en-PH")} recommendations</span>}
    </div>
    <p className="muted">Recommendations reflect members’ experiences. Purchases are not verified by PinoyBuyNSell.</p>
    {loading ? <p>Loading recommendations…</p> : loadError ? <p role="alert">{loadError}</p> : items.length ?
      <div className="seller-recommendation-list">{items.map(item => <article className="seller-recommendation" key={item.id}>
        <div><strong>{item.author_name}</strong><span className="seller-recommendation-badge">Recommends this seller</span></div>
        <p>{item.body}</p><small>{new Date(item.created_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}{item.is_own ? " · Your recommendation" : ""}</small>
      </article>)}</div> : <p>No recommendations yet. Share your experience with this seller.</p>}
    {(offset > 0 || hasMore) && <div className="seller-pagination">
      <button type="button" disabled={loading || offset === 0} onClick={() => setOffset(v => Math.max(0,v-20))}>Previous recommendations</button>
      <button type="button" disabled={loading || !hasMore} onClick={() => setOffset(v => v+20)}>Next recommendations</button>
    </div>}
    {!app?.authReady ? <p>Checking sign-in…</p> : !user ? <Link className="view inline" href="/login">Sign in to recommend this seller</Link> : user.id === sellerId ?
      <p className="muted">Customers can leave recommendations here. You cannot recommend yourself.</p> : profile && <>
        {profile.can_recommend ? <form className="seller-recommendation-form" onSubmit={save}>
          <label htmlFor="seller-recommendation-body">{profile.own_recommendation ? "Edit your recommendation" : "Recommend this seller"}</label>
          <textarea id="seller-recommendation-body" value={draft} onChange={event => setDraft(event.target.value)} rows={4} required maxLength={2000}
            placeholder="What was your experience with this seller?" disabled={busy} />
          <p className="muted">Your recommendation and username will be public. Write 10–1,000 characters; one recommendation per seller.</p>
          <button type="submit" disabled={busy || app?.online === false}>{busy ? "Saving…" : profile.own_recommendation ? "Save recommendation" : "Recommend seller"}</button>
        </form> : <p><Link href="/verify">Complete ID verification</Link> and wait for approval to recommend a seller.</p>}
        {profile.own_recommendation && <button className="seller-remove-recommendation" type="button" disabled={busy || app?.online === false} onClick={() => save(null,true)}>Remove my recommendation</button>}
      </>}
    {message && <p role="status" aria-live="polite">{message}</p>}
  </section>;
}
