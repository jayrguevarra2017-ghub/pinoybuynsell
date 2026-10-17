"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listingShareUrl, listingUrl } from "@/lib/facebook";
import { facebookCaption } from "@/lib/facebook-caption.mjs";
import { listingHashtags } from "@/lib/listing-hashtags.mjs";
import { supabase } from "@/lib/supabase";
import { canPublishListingToPage, facebookPublishingUrl, withFacebookDeadline } from "@/lib/facebook-posting.mjs";

export default function ListingShare({ id, product, user }) {
  const [message, setMessage] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [adminFor, setAdminFor] = useState(null);
  const url = listingUrl(id);
  const hashtags = listingHashtags(product).join(" ");
  const caption = facebookCaption({ ...product, id });
  const ownListing = Boolean(user?.id) && product?.seller_id === user.id && product.status === "active" && !product.deleted_at;
  const pagePublisher = canPublishListingToPage(product, user, adminFor === user?.id);

  useEffect(() => {
    let cancelled = false;
    setAdminFor(null);
    if (ownListing) withFacebookDeadline(supabase.rpc("is_marketplace_admin"))
      .then(result => { if (!cancelled && !result.error && result.data === true) setAdminFor(user.id); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [ownListing, user?.id]);

  async function copyLink() {
    setShowCaption(false);
    try {
      await navigator.clipboard.writeText(url);
      setShowLink(false);
      setMessage("Link copied. Paste it into a post on your Facebook Page.");
    } catch {
      setShowLink(true);
      setMessage("Select and copy the link below, then paste it into your Facebook Page’s post composer.");
    }
  }

  async function copyPost() {
    setShowLink(false);
    try {
      await navigator.clipboard.writeText(caption);
      setShowCaption(false);
      setMessage("Post copied with hashtags. Paste it into your Facebook post.");
    } catch {
      setShowCaption(true);
      setMessage("Select and copy the post below, then paste it into Facebook.");
    }
  }

  return <div className="listing-share">
    <div className="listing-share-actions">
      {pagePublisher && <Link className="facebook-share facebook-page-publish" href={facebookPublishingUrl(id)}>Post to PinoyBuyNSell Page</Link>}
      <a className="facebook-share" href={listingShareUrl(id)} target="_blank" rel="noopener noreferrer">
        {pagePublisher ? "Share to profile or group ↗" : "Share this item on Facebook ↗"}
      </a>
      <button className="facebook-share" type="button" onClick={copyLink}>Copy listing link</button>
      <button className="facebook-share" type="button" onClick={copyPost}>Copy post with hashtags</button>
    </div>
    <p className="listing-share-help">{pagePublisher
      ? "Page posts include these hashtags automatically. Review the listing and confirm posting on the next screen."
      : "Use Copy post with hashtags, then paste into Facebook. Facebook’s share window may not include the caption automatically."}</p>
    <p className="listing-share-hashtags" aria-label="Automatic hashtags">{hashtags}</p>
    {message && <p role="status" className="listing-share-help">{message}</p>}
    {showLink && <label className="listing-share-link">Listing link
      <input type="text" readOnly value={url} onFocus={event => event.currentTarget.select()} />
    </label>}
    {showCaption && <label className="listing-share-link">Facebook post with hashtags
      <textarea aria-label="Facebook post with hashtags" readOnly rows={8} value={caption} onFocus={event => event.currentTarget.select()} />
    </label>}
  </div>;
}
