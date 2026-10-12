"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useApp } from "@/components/AppProvider";
import { supabase } from "@/lib/supabase";
import { usaItemFields, usaItemValues, usaStoreLink } from "@/lib/usa-items.mjs";
import { prepareListingPhoto, photoTypes } from "@/lib/listing-photo-format.mjs";
import { requireSellingAccess } from "@/lib/selling-access.mjs";
import { withDeadline } from "@/lib/verification-actions";

const empty = { title: "", item_url: "", description: "", usd_price: "", status: "published" };
export default function USAItemsAdmin() {
  const app = useApp(), userId = app?.user?.id;
  const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [message, setMessage] = useState("");
  const [form, setForm] = useState(empty), [editing, setEditing] = useState(null), [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false), [deleting, setDeleting] = useState(null);
  const [available, setAvailable] = useState(false);
  const lock = useRef(false), abort = useRef(null), fileInput = useRef(null);
  const load = useCallback(async () => {
    if (!app?.isAdmin || !userId) return;
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 12000);
    setLoading(true); setAvailable(false);
    try {
      const result = await supabase.from("usa_shopping_items").select(usaItemFields).eq("admin_id", userId).order("created_at", { ascending: false }).limit(100).abortSignal(controller.signal);
      if (controller.signal.aborted || result.error) throw Error("Unavailable");
      setItems(result.data || []); setAvailable(true);
    } catch { if (abort.current === controller) setMessage("Could not load USA items. Check that the USA items setup is installed, then refresh."); }
    finally { clearTimeout(timer); if (abort.current === controller) setLoading(false); }
  }, [app?.isAdmin, userId]);
  useEffect(() => { setItems([]); load(); return () => { abort.current?.abort(); abort.current = null; }; }, [load]);
  function reset() { setEditing(null); setForm(empty); setPhoto(null); if (fileInput.current) fileInput.current.value = ""; }
  function edit(item) {
    setEditing(item); setForm({ title: item.title, item_url: item.item_url, description: item.description, usd_price: item.usd_price ?? "", status: item.status });
    setPhoto(null); setMessage(""); if (fileInput.current) fileInput.current.value = "";
    document.getElementById("usa-item-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function save(event) {
    event.preventDefault(); if (lock.current || !app?.isAdmin || !available) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const prepared = photo ? await prepareListingPhoto(photo) : null;
      const path = prepared ? `${userId}/${crypto.randomUUID()}.${photoTypes[prepared.type]}` : editing?.image_path || null;
      const values = usaItemValues(form, path);
      await requireSellingAccess(supabase);
      if (prepared) {
        const uploaded = await withDeadline(supabase.storage.from("listing-photos").upload(path, prepared, { contentType: prepared.type, upsert: false }), 15000);
        if (uploaded.error) throw Error("Photo upload could not be confirmed. Refresh before trying again.");
      }
      const query = editing
        ? supabase.from("usa_shopping_items").update(values).eq("id", editing.id).eq("admin_id", userId).eq("updated_at", editing.updated_at)
        : supabase.from("usa_shopping_items").insert(values);
      const saved = await withDeadline(query.select(usaItemFields).single(), 15000);
      if (saved.error || !saved.data) throw Error(editing ? "Could not confirm the edit. Another change or access issue may be involved; refresh before retrying." : "Could not confirm the save. Refresh the item list before trying again.");
      reset(); setMessage(saved.data.status === "published" ? "USA item published. Customers can now request a quote for it." : "USA item saved. It is hidden from the public catalog.");
      await load();
    } catch (error) { setMessage(error.message || "Could not confirm the item save. Refresh before trying again."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function changeItem(item, action) {
    if (lock.current || !app?.isAdmin || !available) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      await requireSellingAccess(supabase);
      const query = action === "delete" ? supabase.from("usa_shopping_items").delete()
        : supabase.from("usa_shopping_items").update({ status: "archived" });
      const result = await withDeadline(query.eq("id", item.id).eq("admin_id", userId).eq("updated_at", item.updated_at).select("id").single(), 15000);
      if (result.error || result.data?.id !== item.id) throw Error("Could not confirm this change. Refresh before retrying.");
      if (editing?.id === item.id) reset();
      setDeleting(null); setMessage(action === "delete" ? "USA item deleted." : "USA item hidden from the public catalog."); await load();
    } catch (error) { setMessage(error.message || "Could not confirm this change. Refresh before retrying."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <><Header /><main className="page"><div className="container usa-admin-page">
    <h1>Manage USA items</h1><p>Add selected finds from Amazon, eBay and other supported US stores. Customers request a delivered quote; these cards do not place a store order.</p>
    <Link className="back" href="/usa-shopping#usa-finds">View the USA catalog →</Link>
    {!app?.authReady || (app?.user && !app.adminReady) ? <p>Checking administrator access…</p> : !app.isAdmin ? <p>Administrator access required.</p> : <>
      <form id="usa-item-editor" className="listing-form usa-item-editor" onSubmit={save}>
        <h2>{editing ? "Edit USA item" : "Add a USA find"}</h2>
        <label>Item title<input required minLength={3} maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
        <label>Store item link<input required type="url" maxLength={2000} placeholder="https://www.amazon.com/dp/... or https://www.ebay.com/itm/..." value={form.item_url} onChange={e => setForm({ ...form, item_url: e.target.value })} /></label>
        <p className="muted">Supported stores: Amazon, eBay, Walmart, Target, Best Buy and Nike. The source store is detected from the link.</p>
        <label>Item photo<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={e => setPhoto(e.target.files?.[0] || null)} /></label>
        {editing?.image_path && <p className="muted">The existing photo is kept unless you choose a replacement.</p>}
        <label>Description<textarea required minLength={10} maxLength={1500} rows={4} placeholder="Item details, size, color or model, and anything customers should know." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        <label>Reference store price in USD (optional)<input type="number" min="0" max="999999999" step="0.01" value={form.usd_price} onChange={e => setForm({ ...form, usd_price: e.target.value })} /></label>
        <p className="muted">A reference price excludes your service fee, shipping and import charges. Confirm current pricing when quoting.</p>
        <label>Visibility<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Hidden</option></select></label>
        <div className="usa-admin-actions"><button className="sell" disabled={busy || !available}>{busy ? "Saving…" : editing ? "Save USA item" : form.status === "published" ? "Publish USA item" : "Save draft"}</button>{editing && <button type="button" className="view" disabled={busy} onClick={reset}>Cancel editing</button>}</div>
      </form>
      {message && <p role="status" aria-live="polite">{message}</p>}
      <div className="section-head usa-admin-heading"><h2>Your USA items</h2><button className="view" type="button" disabled={busy || loading} onClick={() => { setMessage(""); load(); }}>Refresh items</button></div>
      {loading ? <p>Loading items…</p> : !available ? <p>Item management is unavailable until setup and access can be confirmed.</p> : !items.length ? <p>No USA items added yet.</p> : <div className="usa-item-grid">{items.map(item => <article className="usa-item-card" key={item.id}>
        <div className="usa-item-photo">{item.image_path && <img src={supabase.storage.from("listing-photos").getPublicUrl(item.image_path).data.publicUrl} alt={item.title} loading="lazy" />}</div>
        <div className="usa-item-copy"><p className="eyebrow">{item.store} · {item.status}</p><h3>{item.title}</h3><p>{item.description}</p>
          {usaStoreLink(item.item_url) && <a className="view" href={usaStoreLink(item.item_url).href} target="_blank" rel="noopener noreferrer">Open store item ↗</a>}
          <div className="usa-admin-actions"><button type="button" className="view" disabled={busy} onClick={() => edit(item)}>Edit</button>{item.status === "published" && <button type="button" className="view" disabled={busy} onClick={() => changeItem(item, "hide")}>Hide</button>}<button type="button" className="view" disabled={busy} onClick={() => setDeleting(item.id)}>Delete</button></div>
          {deleting === item.id && <div className="usa-delete-confirm" role="group" aria-label={`Delete ${item.title}`}><p>Delete this USA item? Existing customer quote requests are kept.</p><button type="button" disabled={busy} onClick={() => changeItem(item, "delete")}>Confirm delete</button><button type="button" disabled={busy} onClick={() => setDeleting(null)}>Keep item</button></div>}
        </div>
      </article>)}</div>}
    </>}
  </div></main></>;
}
