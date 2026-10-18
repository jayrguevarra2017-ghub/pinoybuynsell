"use client";
import { useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { canPublishUSAItem, usaItemCaption, usaItemPublishingPath, usaItemShareUrl, usaItemUrl } from "@/lib/usa-item-sharing.mjs";

export default function USAItemShare({ item }) {
  const app = useApp();
  const [message, setMessage] = useState(""), [fallback, setFallback] = useState(null);
  if (item?.status !== "published" || !usaItemUrl(item?.id)) return null;
  const publisher = canPublishUSAItem(item, app?.user, app?.isAdmin);
  async function copy(kind) {
    const value = kind === "link" ? usaItemUrl(item.id) : usaItemCaption(item);
    try {
      await navigator.clipboard.writeText(value); setFallback(null);
      setMessage(kind === "link" ? "Item link copied." : "Post copied with hashtags. Paste it into your Facebook post.");
    } catch { setFallback(kind); setMessage("Select and copy the text below, then paste it into Facebook."); }
  }
  return <div className="usa-item-sharing">
    {publisher && <Link className="facebook-share facebook-page-publish" href={usaItemPublishingPath(item.id)}>Post to PinoyBuyNSell Page</Link>}
    <details>
      <summary>Share on Facebook</summary>
      <div className="listing-share-actions">
        <a className="facebook-share" href={usaItemShareUrl(item.id)} target="_blank" rel="noopener noreferrer">Share to Facebook ↗</a>
        <button className="facebook-share" type="button" onClick={() => copy("link")}>Copy item link</button>
        <button className="facebook-share" type="button" onClick={() => copy("post")}>Copy post with hashtags</button>
      </div>
      <p className="listing-share-help">Copy the post and paste it into Facebook to include the description and hashtags.</p>
      {message && <p role="status" className="listing-share-help">{message}</p>}
      {fallback && <label className="listing-share-link">{fallback === "link" ? "Item link" : "Facebook post with hashtags"}
        <textarea readOnly rows={fallback === "link" ? 3 : 8} value={fallback === "link" ? usaItemUrl(item.id) : usaItemCaption(item)} onFocus={event => event.currentTarget.select()} />
      </label>}
    </details>
  </div>;
}
