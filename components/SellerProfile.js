"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import OrderedProductGrid from "@/components/OrderedProductGrid";
import SellerSummary from "@/components/SellerSummary";
import SellerRecommendations from "@/components/SellerRecommendations";
import { useApp } from "@/components/AppProvider";
import { supabase } from "@/lib/supabase";
import { communityRequest, communityError, validSellerId } from "@/lib/seller-community.mjs";
import { fetchMarketplaceListings } from "@/lib/marketplace-client.mjs";

export default function SellerProfile({ sellerId }) {
  const app = useApp();
  return <ProfileContent key={`${sellerId}:${app?.user?.id || "guest"}`} sellerId={sellerId} />;
}

function ProfileContent({ sellerId }) {
  const [profile, setProfile] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [products, setProducts] = useState([]), [listingError, setListingError] = useState(""), [listingLoading, setListingLoading] = useState(true);
  const [page, setPage] = useState(0), [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!validSellerId(sellerId)) { setError("This seller profile is unavailable."); setLoading(false); return; }
    let cancelled = false;
    communityRequest(supabase.rpc("marketplace_seller_profile", { p_seller_id: sellerId }))
      .then(data => { if (!cancelled) { setProfile(data); if (!data) setError("This seller profile is unavailable."); } })
      .catch(e => { if (!cancelled) setError(communityError(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sellerId]);

  useEffect(() => {
    if (!validSellerId(sellerId)) { setListingLoading(false); return; }
    let cancelled = false; setListingLoading(true); setListingError("");
    let running = false;
    async function load() {
      if (running) return;
      running = true;
      try {
        const rows = await fetchMarketplaceListings({ seller: sellerId, page: page + 1 });
        if (!cancelled) { setProducts(rows.slice(0, 24)); setHasMore(rows.length > 24); setListingError(""); }
      } catch { if (!cancelled) setListingError("Could not load listings. Please try again."); }
      finally { if (!cancelled) setListingLoading(false); running = false; }
    }
    load();
    const timer = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [sellerId, page]);

  return <><Header /><main className="page seller-profile-page"><div className="container">
    <Link className="back" href="/search">← Back to marketplace</Link>
    <p className="eyebrow">MEET THE SELLER</p><h1>{profile?.username || "Seller profile"}</h1>
    {profile?.location && <p className="muted">📍 {profile.location}</p>}
    {loading ? <p>Loading seller…</p> : error ? <p role="alert">{error}</p> : <SellerSummary sellerId={sellerId} profile={profile} onChange={setProfile} />}
    <section className="seller-listings" aria-labelledby="seller-listings-title">
      <div className="section-head"><h2 id="seller-listings-title">Seller’s listings</h2>{profile && <span>{profile.active_listing_count} active {Number(profile.active_listing_count) === 1 ? "listing" : "listings"}</span>}</div>
      {listingLoading ? <p>Loading listings…</p> : listingError ? <p role="alert">{listingError}</p> : products.length ?
        <OrderedProductGrid products={products} /> : <p>No listings to show.</p>}
      {(page>0 || hasMore) && <div className="seller-pagination"><button type="button" disabled={listingLoading || page===0} onClick={() => setPage(v => Math.max(0,v-1))}>Previous listings</button>
        <button type="button" disabled={listingLoading || !hasMore} onClick={() => setPage(v => v+1)}>Next listings</button></div>}
    </section>
    {profile && <SellerRecommendations sellerId={sellerId} profile={profile} onChange={setProfile} />}
  </div></main></>;
}
