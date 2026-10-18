"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { useApp } from "@/components/AppProvider";
import { supabase } from "@/lib/supabase";
import { usaItemFields, usaItemId } from "@/lib/usa-items.mjs";
import { canPublishUSAItem, usaFacebookJobId, usaItemCaption, usaItemPath } from "@/lib/usa-item-sharing.mjs";
import { facebookPostingState, withFacebookDeadline } from "@/lib/facebook-posting.mjs";
import { publishUSAItem } from "@/lib/usa-facebook-posting.mjs";
import { facebookPageUrl } from "@/lib/facebook";

export default function Page() {
  return <Suspense fallback={<><Header /><main className="page"><p role="status">Loading USA item posting…</p></main></>}><USAItemPublishing /></Suspense>;
}

function USAItemPublishing() {
  const app = useApp(), itemId = useSearchParams().get("item"), userId = app?.user?.id;
  const [item, setItem] = useState(null), [post, setPost] = useState(null), [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const lock = useRef(false), revision = useRef(0);
  const load = useCallback(async () => {
    const current = ++revision.current;
    setItem(null); setPost(null); setReady(false); setMessage(""); setLoading(false);
    if (!app?.isAdmin || !userId) return;
    if (!usaItemId(itemId)) { setMessage("Choose a published USA item from Manage USA items."); return; }
    setLoading(true);
    try {
      const [result, record] = await Promise.all([
        withFacebookDeadline(supabase.from("usa_shopping_items").select(usaItemFields).eq("id", itemId).eq("admin_id", userId).eq("status", "published").maybeSingle()),
        withFacebookDeadline(supabase.from("facebook_listing_posts").select("listing_id,status,post_id,message,updated_at").eq("listing_id", usaFacebookJobId(itemId)).eq("owner_id", userId).maybeSingle()),
      ]);
      if (current !== revision.current) return;
      if (result.error || record.error) throw Error("Unavailable");
      if (!canPublishUSAItem(result.data, { id: userId }, true)) { setMessage("This USA item is hidden, unavailable or belongs to another administrator."); return; }
      setItem(result.data); setPost(facebookPostingState(record.data)); setReady(true);
    } catch { if (current === revision.current) setMessage("Could not load the item and its posting status. Refresh to try again."); }
    finally { if (current === revision.current) setLoading(false); }
  }, [app?.isAdmin, userId, itemId]);
  useEffect(() => { load(); return () => { revision.current++; }; }, [load]);

  async function publish() {
    if (lock.current || !ready || !canPublishUSAItem(item, app?.user, app?.isAdmin)) return;
    lock.current = true; setBusy(true); setMessage("Posting USA item to the PinoyBuyNSell Page…");
    const current = revision.current;
    try {
      const result = await publishUSAItem(supabase, item.id);
      if (current !== revision.current) return;
      if (["published", "failed", "uncertain", "processing"].includes(result.status)) setPost({
        status: result.status, post_id: result.postId, message: result.message, updated_at: new Date().toISOString(),
      });
      // Require a fresh ledger read before another attempt, even after failure.
      setReady(false); setMessage(result.message);
    } catch {
      if (current === revision.current) { setReady(false); setMessage("Could not confirm the result. Check your Facebook Page and refresh posting status before retrying; the post may already exist."); }
    } finally { setBusy(false); lock.current = false; }
  }
  const authorized = app?.isAdmin && userId;
  return <><Header /><main className="page"><div className="container narrow">
    <p className="eyebrow">USA FINDS · ADMINISTRATOR POSTING</p><h1 className="facebook-publishing-title">Post USA item to Facebook</h1>
    <p>Review the saved item below, then confirm posting to the PinoyBuyNSell Page. It includes the photo, website link, reference USD price and relevant hashtags. Opening this screen does not post.</p>
    <p>Published posts keep the details shown at posting time. Edit later changes directly on Facebook. Hiding or deleting a website item does not remove its Facebook post.</p>
    <div className="listing-share-actions"><Link className="facebook-share" href="/admin/usa-items">Manage USA items</Link><a className="facebook-share" href={facebookPageUrl} target="_blank" rel="noopener noreferrer">Open Facebook Page ↗</a></div>
    {!app?.authReady || (app?.user && !app.adminReady) ? <p role="status">Checking administrator access…</p> : !authorized ? <p>Sign in with an administrator account to post your own USA items.</p> : <>
      <button className="view" type="button" disabled={loading || busy} onClick={load}>Refresh posting status</button>
      {loading && <p role="status">Loading item and posting status…</p>}
      {item && <article className="usa-facebook-review">
        <img className="usa-facebook-photo" src={supabase.storage.from("listing-photos").getPublicUrl(item.image_path).data.publicUrl} alt={item.title} />
        <h2>{item.title}</h2><Link className="view" href={usaItemPath(item.id)}>View USA item</Link>
        <label className="listing-share-link">Facebook post preview<textarea readOnly rows={12} value={usaItemCaption(item)} /></label>
        {post && <p>Facebook status: <strong>{post.status}</strong>{post.message && ` — ${post.message}`}</p>}
        {post?.status === "published" && /^\d+(?:_\d+)?$/.test(post.post_id || "")
          ? <a className="view" href={`https://www.facebook.com/${post.post_id}`} target="_blank" rel="noopener noreferrer">View Facebook post ↗</a>
          : <button type="button" className="sell" disabled={!ready || busy || (post && post.status !== "failed")} onClick={publish}>{busy ? "Posting…" : post?.status === "failed" ? "Retry Facebook post" : "Post to Facebook"}</button>}
        {post?.status === "uncertain" && <p>Check the Facebook Page for this item. Ask the site owner to resolve its saved status before another attempt.</p>}
      </article>}
    </>}
    {message && <p role="status">{message}</p>}
  </div></main></>;
}
