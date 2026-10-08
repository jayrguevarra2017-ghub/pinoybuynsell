"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import ListingPhoto from "@/components/ListingPhoto";
import ShippingDetails from "@/components/ShippingDetails";
import { supabase } from "@/lib/supabase";
import { withDeadline } from "@/lib/verification-actions";

export default function FacebookListings() {
  const [items, setItems] = useState([]), [posts, setPosts] = useState({});
  const [allowed, setAllowed] = useState(false), [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(null), [message, setMessage] = useState("Checking administrator access...");
  const lock = useRef(false);

  async function load() {
    setReady(false);
    try {
      const auth = await withDeadline(supabase.auth.getUser());
      const admin = await withDeadline(supabase.rpc("is_marketplace_admin"));
      if (auth.error || !auth.data?.user || admin.error || admin.data !== true) {
        setAllowed(false); setItems([]); setPosts({}); setMessage("Administrator access required."); return;
      }
      setAllowed(true);
      const result = await withDeadline(supabase.from("products").select("*").eq("seller_id", auth.data.user.id)
        .eq("status", "active").is("deleted_at", null).order("created_at", { ascending: false }).limit(100));
      if (result.error) throw result.error;
      setItems(result.data || []);
      const records = await withDeadline(supabase.from("facebook_listing_posts").select("listing_id,status,post_id,message,updated_at"));
      if (records.error) { setMessage("Install the Facebook publishing SQL migration to enable posting status."); return; }
      setPosts(Object.fromEntries((records.data || []).map(post => [post.listing_id, post])));
      setReady(true); setMessage("");
    } catch { setMessage("Could not load Facebook posting status. Refresh to try again."); }
  }
  useEffect(() => { load(); }, []);

  async function publish(item) {
    if (lock.current || !ready) return;
    lock.current = true; setBusy(String(item.id)); setMessage(`Posting “${item.title}” to Facebook...`);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;
      if (!token) throw new Error("Sign in again before posting.");
      const response = await fetch("/api/facebook/publish", { method: "POST", headers: {
        Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: String(item.id) }), signal: AbortSignal.timeout(45000) });
      const result = await response.json();
      await load();
      setMessage(result.message || "Refresh to check the posting result.");
    } catch (error) {
      await load();
      setMessage(error.message === "Sign in again before posting." ? error.message
        : "Could not confirm the result. Refresh status and check Facebook before retrying; the post may already exist.");
    } finally { lock.current = false; setBusy(null); }
  }

  return <><Header /><main className="page"><div className="container narrow">
    <p className="eyebrow">ADMINISTRATOR FACEBOOK POSTING</p><h1>Post your listings to Facebook</h1>
    <p>Publish your own active listings to the PinoyBuyNSell Facebook Page. A post includes the item details, shipping fee, website link, and photo when attached. Showing your latest 100 active listings.</p>
    <p>Each listing can be posted once. Editing or deleting a website listing does not change an existing Facebook post.</p>
    {message && <p role="status" aria-live="polite">{message}</p>}
    <button className="view" disabled={busy !== null} onClick={load}>Refresh posting status</button>
    {allowed && items.length === 0 && <p>You have no active listings. <Link href="/sell">Create a listing</Link>.</p>}
    {allowed && items.map(item => {
      const record = posts[String(item.id)];
      const post = record?.status === "processing" && Date.now() - Date.parse(record.updated_at) > 120000
        ? { ...record, status: "uncertain", message: "Posting was interrupted. Check Facebook before another attempt." } : record;
      return <article className="listing-form" key={item.id} style={{ padding: 24, marginTop: 24, background: "white", border: "1px solid #ddd", borderRadius: 16 }}>
        <ListingPhoto product={item} detail /><h2>{item.title}</h2><p>₱{Number(item.price).toLocaleString("en-PH")}</p>
        <ShippingDetails product={item} /><Link className="view" href={`/product/${item.id}`}>View listing</Link>
        {post && <p>Facebook status: <strong>{post.status}</strong>{post.message && ` — ${post.message}`}</p>}
        {post?.status === "published" && /^\d+(?:_\d+)?$/.test(post.post_id || "")
          ? <a className="view" href={`https://www.facebook.com/${post.post_id}`} target="_blank" rel="noopener noreferrer">View Facebook post ↗</a>
          : <button className="sell" disabled={!ready || busy !== null || (post && !["failed"].includes(post.status))} onClick={() => publish(item)}>
            {busy === String(item.id) ? "Posting..." : post?.status === "failed" ? "Retry Facebook post" : "Post to Facebook"}
          </button>}
        {post?.status === "uncertain" && <p>Check your Facebook Page for this listing. Ask the site owner to resolve its saved status before another attempt.</p>}
      </article>;
    })}
  </div></main></>;
}
