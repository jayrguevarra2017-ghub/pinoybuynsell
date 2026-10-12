"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";
import { usaItemFields, usaStores, usaStoreLink } from "@/lib/usa-items.mjs";

export default function USAItemCatalog({ onChoose }) {
  const app = useApp(), chooseRef = useRef(onChoose), selected = useRef(false);
  const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [store, setStore] = useState("All stores"), [limit, setLimit] = useState(12);
  const abort = useRef(null);
  useEffect(() => { chooseRef.current = onChoose; }, [onChoose]);
  const load = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    const deadline = setTimeout(() => controller.abort(), 12000);
    setLoading(true); setError("");
    try {
      const result = await supabase.from("usa_shopping_items").select(usaItemFields).eq("status", "published").order("created_at", { ascending: false }).limit(100).abortSignal(controller.signal);
      if (controller.signal.aborted || result.error) throw Error("Catalog unavailable");
      const rows = (result.data || []).filter(item => item.status === "published" && usaStoreLink(item.item_url));
      setItems(rows);
      if (!selected.current) {
        const wanted = new URLSearchParams(window.location.search).get("item");
        const item = rows.find(row => row.id === wanted);
        if (item) { selected.current = true; chooseRef.current?.(item); }
      }
    } catch { if (abort.current === controller) setError("USA finds are unavailable right now. You can still paste your store link in the quote form below."); }
    finally { clearTimeout(deadline); if (abort.current === controller) setLoading(false); }
  }, []);
  useEffect(() => { load(); return () => { abort.current?.abort(); abort.current = null; }; }, [load]);
  const matches = items.filter(item => store === "All stores" || item.store === store);
  return <section className="container usa-catalog" id="usa-finds" aria-labelledby="usa-finds-title">
    <div className="section-head"><div><p className="eyebrow">SELECTED USA FINDS</p><h2 id="usa-finds-title">Explore items from US stores</h2></div>
      {app?.isAdmin && <Link href="/admin/usa-items">Manage USA items</Link>}</div>
    <p>Find something you like? Request a quote for shopping assistance and delivery to the Philippines. Store prices and availability can change; service fees, shipping and import charges are quoted separately.</p>
    <div className="usa-store-links" aria-label="Browse source stores">{usaStores.map(source => <a key={source.name} href={source.href} target="_blank" rel="noopener noreferrer">{source.name} ↗</a>)}</div>
    {loading ? <p role="status">Loading USA finds…</p> : error ? <div><p role="status">{error}</p><button type="button" className="view" onClick={load}>Try loading items again</button></div> : <>
      {items.length > 0 && <label className="usa-store-filter">Source store<select value={store} onChange={event => { setStore(event.target.value); setLimit(12); }}><option>All stores</option>{usaStores.map(source => <option key={source.name}>{source.name}</option>)}</select></label>}
      {!matches.length && <p>{items.length ? "No selected items from this store yet." : "New USA finds are coming soon. You can already request a quote using your own store link below."}</p>}
      <div className="usa-item-grid">{matches.slice(0, limit).map(item => <article key={item.id} className="usa-item-card">
        <div className="usa-item-photo">{item.image_path ? <img src={supabase.storage.from("listing-photos").getPublicUrl(item.image_path).data.publicUrl} alt={item.title} loading="lazy" /> : <span aria-hidden="true">{item.store}</span>}</div>
        <div className="usa-item-copy"><p className="eyebrow">{item.store}</p><h3>{item.title}</h3>
          {item.usd_price != null && <p className="usa-item-price">Reference store price: {Number(item.usd_price).toLocaleString("en-US", { style: "currency", currency: "USD" })}</p>}
          <p className="usa-item-description">{item.description}</p>
          <a className="view" href={usaStoreLink(item.item_url).href} target="_blank" rel="noopener noreferrer">View on {item.store} ↗</a>
          <button type="button" className="usa-item-quote" onClick={() => { selected.current = true; chooseRef.current?.(item); }}>Request a quote</button>
        </div>
      </article>)}</div>
      {matches.length > limit && <button type="button" className="view" onClick={() => setLimit(value => value + 12)}>Show more USA finds</button>}
    </>}
  </section>;
}
