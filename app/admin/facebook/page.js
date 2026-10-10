"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import ListingPhoto from "@/components/ListingPhoto";
import ShippingDetails from "@/components/ShippingDetails";
import { facebookPageUrl } from "@/lib/facebook";
import { supabase } from "@/lib/supabase";
import { facebookDebuggerUrl, facebookPostingBlocked, facebookPostingState, publishFacebookListing, validFacebookListingId, withFacebookDeadline } from "@/lib/facebook-posting.mjs";
import { updateFacebookDetails } from "@/lib/facebook-edit-sync.mjs";
import { facebookSyncBusy } from "@/lib/facebook-sync-state.mjs";

export default function FacebookPage() {
  return <Suspense fallback={<><Header /><main className="page"><div className="container"><p role="status">Loading Page publishing...</p></div></main></>}>
    <FacebookListings />
  </Suspense>;
}

function FacebookListings() {
  const params = useSearchParams(), listingId = params.get("listing");
  const [items, setItems] = useState([]), [posts, setPosts] = useState({});
  const [allowed, setAllowed] = useState(false), [ready, setReady] = useState(false), [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null), [message, setMessage] = useState("Checking administrator access...");
  const lock = useRef(false), loadVersion = useRef(0);

  async function load() {
    const version = ++loadVersion.current;
    setReady(false); setLoading(true); setItems([]); setPosts({});
    try {
      if (listingId !== null && !validFacebookListingId(listingId)) {
        setAllowed(false); setMessage("Invalid listing link. Open all your Facebook listings below."); return;
      }
      const [auth, admin] = await Promise.all([
        withFacebookDeadline(supabase.auth.getUser()), withFacebookDeadline(supabase.rpc("is_marketplace_admin")),
      ]);
      if (version !== loadVersion.current) return;
      if (auth.error || !auth.data?.user || admin.error || admin.data !== true) {
        setAllowed(false); setMessage("Sign in with an administrator account to post your own listings to the Page."); return;
      }
      setAllowed(true);
      let query = supabase.from("products").select("*").eq("seller_id", auth.data.user.id)
        .eq("status", "active").is("deleted_at", null).order("created_at", { ascending: false });
      query = listingId !== null ? query.eq("id", listingId).limit(1) : query.limit(100);
      let recordQuery = supabase.from("facebook_listing_posts").select("listing_id,status,post_id,message,updated_at");
      if (listingId !== null) recordQuery = recordQuery.eq("listing_id", listingId);
      const [result, records] = await Promise.all([withFacebookDeadline(query), withFacebookDeadline(recordQuery)]);
      if (version !== loadVersion.current) return;
      if (result.error) throw result.error;
      setItems(result.data || []);
      if (records.error) { setMessage("Posting status is unavailable. Check that the Facebook publishing SQL setup is installed, then refresh."); return; }
      setPosts(Object.fromEntries((records.data || []).map(post => [post.listing_id, post])));
      setReady(true); setMessage("");
    } catch {
      if (version === loadVersion.current) setMessage("Could not load Facebook posting status. Refresh to try again.");
    } finally { if (version === loadVersion.current) setLoading(false); }
  }
  useEffect(() => {
    load();
    return () => { loadVersion.current++; };
  }, [listingId]);

  async function publish(item) {
    if (lock.current || !ready) return;
    lock.current = true; setBusy(String(item.id)); setMessage(`Posting “${item.title}” to the PinoyBuyNSell Page...`);
    let resultMessage;
    try {
      const result = await publishFacebookListing(supabase, String(item.id));
      resultMessage = result.message;
      // Show the saved status immediately while the latest records are checked.
      if (["published", "failed", "uncertain", "processing"].includes(result.status)) {
        setPosts(current => ({ ...current, [String(item.id)]: {
          listing_id: String(item.id), status: result.status, post_id: result.postId,
          message: result.message, updated_at: new Date().toISOString(),
        } }));
      }
    } catch (error) {
      resultMessage = error.message === "Sign in again before posting." ? error.message
        : "Could not confirm the result. Check your Facebook Page and refresh status before retrying; the post may already exist.";
    } finally { setBusy(null); }
    setMessage(resultMessage);
    try { await load(); } finally { setMessage(resultMessage); lock.current = false; }
  }

  async function sync(item) {
    if(lock.current || !ready) return;
    lock.current=true;setBusy(String(item.id));setMessage(`Updating Facebook details for “${item.title}”…`);
    let resultMessage;
    try { resultMessage=(await updateFacebookDetails(supabase,String(item.id))).message; }
    catch(error){resultMessage=error.message || "Check the Facebook post and refresh its update status.";}
    finally{setBusy(null);}
    try{await load();}finally{setMessage(resultMessage);lock.current=false;}
  }

  return <><Header /><main className="page"><div className="container narrow">
    <p className="eyebrow">ADMINISTRATOR FACEBOOK POSTING</p><h1 className="facebook-publishing-title">Post to PinoyBuyNSell Page</h1>
    <p>Review your own active listing, then click Post to Facebook. The website publishes directly to the PinoyBuyNSell Page with the item details, shipping fee, website link, and cover photo.</p>
    <p>Saving a website listing edit automatically updates the text of its linked Page post. Use Update Facebook details to retry an update. Change a published photo or link preview directly on Facebook.</p>
    <p>Check your Facebook Page before posting here. Posts made through Facebook’s share window do not appear in this posting status.</p>
    <div className="listing-share-actions" style={{ marginBottom: 16 }}>
      <a className="facebook-share" href={facebookPageUrl} target="_blank" rel="noopener noreferrer">Open Facebook Page ↗</a>
      {listingId !== null && <Link className="facebook-share" href="/admin/facebook">All my Facebook listings</Link>}
    </div>
    {message && <p role="status" aria-live="polite">{message}</p>}
    {loading && <p role="status">Checking posting status...</p>}
    <button className="view" disabled={busy !== null || loading} onClick={load}>Refresh posting status</button>
    {!allowed && !loading && <Link className="view" href="/login">Sign in</Link>}
    {allowed && ready && items.length === 0 && <p>{listingId !== null
      ? "This listing is unavailable or does not belong to your administrator account."
      : <>You have no active listings. <Link href="/sell">Create a listing</Link>.</>}</p>}
    {allowed && items.map(item => {
      const post = facebookPostingState(posts[String(item.id)]);
      return <article className="listing-form" key={item.id} style={{ padding: 24, marginTop: 24, background: "white", border: "1px solid #ddd", borderRadius: 16 }}>
        <ListingPhoto product={item} detail /><h2>{item.title}</h2><p>₱{Number(item.price).toLocaleString("en-PH")}</p>
        <ShippingDetails product={item} /><Link className="view" href={`/product/${item.id}`}>View listing</Link>
        {post && <p>Facebook status: <strong>{post.status}</strong>{post.message && ` — ${post.message}`}</p>}
        {facebookPostingBlocked(post) && <aside className="facebook-blocked-help" aria-label="Facebook publishing checks">
          <p>Check this listing’s URL for Facebook warnings, then review any instructions Meta provides. These links open diagnostic screens and do not publish a post.</p>
          <a className="view" href={facebookDebuggerUrl(item.id)} target="_blank" rel="noopener noreferrer">Check listing in Meta Sharing Debugger ↗</a>
          <a className="view" href="https://www.facebook.com/account_status/" target="_blank" rel="noopener noreferrer">Check Facebook Account Status ↗</a>
        </aside>}
        {post?.status === "published" && /^\d+(?:_\d+)?$/.test(post.post_id || "")
          ? <><a className="view" href={`https://www.facebook.com/${post.post_id}`} target="_blank" rel="noopener noreferrer">View Facebook post ↗</a>
              <button className="sell" type="button" disabled={!ready || busy !== null || facebookSyncBusy(post)} onClick={() => sync(item)}>
                {busy===String(item.id) || facebookSyncBusy(post) ? "Updating Facebook…" : "Update Facebook details"}</button>
              <Link className="view" href={`/account/listings/${item.id}/edit`}>Edit website listing</Link></>
          : <button className="sell" disabled={!ready || busy !== null || (post && post.status !== "failed")} onClick={() => publish(item)}>
            {busy === String(item.id) ? "Posting..." : post?.status === "failed" ? "Retry Facebook post" : "Post to Facebook"}
          </button>}
        {post?.status === "uncertain" && <p>Check your Facebook Page for this listing. Ask the site owner to resolve its saved status before another attempt.</p>}
      </article>;
    })}
  </div></main></>;
}
