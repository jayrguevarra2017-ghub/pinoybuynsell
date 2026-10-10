"use client";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import AuctionCard from "@/components/AuctionCard";
import { fetchMarketplaceListings } from "@/lib/marketplace-client.mjs";
import { sortAuctionCards } from "@/lib/listing-order.mjs";
import useMarketplaceClock from "./useMarketplaceClock";

export default function AuctionsPage({ initialAuctions = null }) {
  const [auctions, setAuctions] = useState(initialAuctions || []);
  const [loading, setLoading] = useState(initialAuctions === null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const now = useMarketplaceClock();
  useEffect(() => {
    let cancelled = false, running = false;
    if (page > 1) setLoading(true);
    async function load() {
      if (running) return;
      running = true;
      try {
        const items = await fetchMarketplaceListings({ mode: "auctions", page });
        if (!cancelled) { setAuctions(items); setError(""); }
      } catch { if (!cancelled) setError("Could not load auctions. Please refresh to try again."); }
      finally { if (!cancelled) setLoading(false); running = false; }
    }
    load();
    const timer = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [page]);
  const ordered = now === null ? auctions : sortAuctionCards(auctions, now);
  return <><Header /><main className="page"><div className="container">
    <p className="eyebrow">BID & WIN</p><h1>Auctions</h1>
    <p className="lead">Ending soonest first. Sold items and ended auctions appear last.</p>
    {loading ? <p>Loading auctions...</p> : error ? <p role="alert">{error}</p> : !auctions.length ? <p>No auctions to show.</p> :
      <div className="auction-grid">{ordered.slice(0, 24).map(a => <AuctionCard key={a.id} item={a} />)}</div>}
    {(page > 1 || auctions.length > 24) && <nav className="seller-pagination" aria-label="Auction pages">
      <button type="button" disabled={loading || page === 1} onClick={() => setPage(p => p - 1)}>Previous auctions</button>
      <button type="button" disabled={loading || !!error || auctions.length <= 24 || page >= 1000} onClick={() => setPage(p => p + 1)}>Next auctions</button>
    </nav>}
  </div></main></>;
}
