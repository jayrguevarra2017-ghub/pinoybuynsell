"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import ListingPhoto from "@/components/ListingPhoto";
import ListingManagementActions from "@/components/ListingManagementActions";
import { useApp } from "@/components/AppProvider";
import { supabase } from "@/lib/supabase";
import { withDeadline } from "@/lib/verification-actions";
import { managementListingFields } from "@/lib/listing-management.mjs";
import { listingAvailability } from "@/lib/listing-order.mjs";

export default function AdminListings() {
  const app = useApp();
  return <AdminListingsContent key={`${app?.user?.id || "guest"}:${app?.isAdmin}`} />;
}

function AdminListingsContent() {
  const app = useApp();
  const [items, setItems] = useState([]), [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!app?.isAdmin) return;
    let active = true;
    setLoading(true); setMessage(""); setItems([]);
    (async () => {
      try {
        const check = await withDeadline(supabase.rpc("is_marketplace_admin"));
        if (check.error || check.data !== true) throw Error("Administrator access required.");
        const result = await withDeadline(supabase.from("products").select(managementListingFields)
          .order("created_at", { ascending: false }).limit(100));
        if (result.error || !Array.isArray(result.data)) throw Error("Could not load listings. Please refresh to try again.");
        if (active) setItems(result.data);
      } catch (error) { if (active) setMessage(error.message || "Could not load listings."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [app?.isAdmin, revision]);
  return <><Header /><main className="page"><div className="container narrow">
    <h1>Manage listings</h1>
    {!app?.adminReady ? <p>Checking administrator access…</p> : !app.isAdmin ? <>
      <p role="alert">{app.adminError || "Administrator access required."}</p>
      <Link className="view" href={app.user ? "/account" : "/login"}>{app.user ? "My account" : "Sign in"}</Link>
    </> : <>
      <p>Relist your ended items with fresh selling settings. Delete any listing from the marketplace while keeping its auction and bid history. Showing the latest 100 listings.</p>
      {message && <p role="status" aria-live="polite">{message}</p>}
      <button type="button" className="view" disabled={loading || !app.online} onClick={() => setRevision(value => value + 1)}>Refresh listings</button>
      {loading ? <p>Loading listings…</p> : !message && items.length === 0 && <p>No listings found.</p>}
      {items.map(item => <article key={item.id} className="listing-form" style={{ padding: 20, border: "1px solid #ddd", marginTop: 20 }}>
        <ListingPhoto product={item} detail /><h2>{item.title}</h2>
        <p>Listing {item.id} · ₱{Number(item.price).toLocaleString("en-PH")} · {item.deleted_at ? "Deleted" : listingAvailability(item).label}</p>
        <p>Seller: {item.seller_id}</p>
        {!item.deleted_at && <>
          <Link className="view" href={`/product/${item.id}`}>View listing</Link>
          {item.seller_id === app.user?.id && <Link className="view" href={`/account/listings/${item.id}/edit`}>Edit listing</Link>}
          <ListingManagementActions key={`${item.id}:${revision}`} product={item}
            onDeleted={deleted => { setItems(current => current.map(row => String(row.id) === String(deleted.id) ? deleted : row)); setMessage("Listing deleted from the marketplace. Auction and bid records were retained."); }}
            onRefresh={() => setRevision(value => value + 1)} />
        </>}
      </article>)}
    </>}
  </div></main></>;
}
