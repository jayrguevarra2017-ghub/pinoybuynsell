"use client";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import AuctionCard from "@/components/AuctionCard";
import { supabase } from "@/lib/supabase";

export default function AuctionsPage({ initialAuctions = null }) {
  const [auctions, setAuctions] = useState(initialAuctions || []);
  const [loading, setLoading] = useState(initialAuctions === null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabase.from("auctions")
          .select("id,product_id,starting_price,current_bid,starts_at,ends_at,status,products!inner(id,title,location,status,deleted_at)")
          .eq("status", "active").eq("products.status", "active").is("products.deleted_at", null)
          .gt("ends_at", new Date().toISOString()).order("ends_at", { ascending: true });
        if (error) throw error;
        if (!cancelled) setAuctions((data || []).map(a => ({ id: a.id, productId: a.product_id,
          title: a.products.title, location: a.products.location,
          currentBid: a.current_bid ?? a.starting_price, startTime: a.starts_at, status: a.status, endTime: a.ends_at, icon: "🏷️" })));
      } catch { if (!cancelled) setError("Could not load auctions. Please refresh to try again."); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);
  return <><Header /><main className="page"><div className="container">
    <p className="eyebrow">BID & WIN</p><h1>Live Auctions</h1>
    <p className="lead">Open an item to review its details and place a bid.</p>
    {loading ? <p>Loading auctions...</p> : error ? <p role="alert">{error}</p> : !auctions.length ? <p>No active auctions right now.</p> :
      <div className="auction-grid">{auctions.map(a => <AuctionCard key={a.id} item={a} />)}</div>}
  </div></main></>;
}
