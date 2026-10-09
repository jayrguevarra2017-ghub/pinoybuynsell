"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listingShareUrl, listingUrl } from "@/lib/facebook";
import { supabase } from "@/lib/supabase";
import { canPublishListingToPage, facebookPublishingUrl, withFacebookDeadline } from "@/lib/facebook-posting.mjs";

export default function ListingShare({ id, product, user }) {
  const [message, setMessage] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [adminFor, setAdminFor] = useState(null);
  const url = listingUrl(id);
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
    try {
      await navigator.clipboard.writeText(url);
      setShowLink(false);
      setMessage("Link copied. Paste it into a post on your Facebook Page.");
    } catch {
      setShowLink(true);
      setMessage("Select and copy the link below, then paste it into your Facebook Page’s post composer.");
    }
  }

  return <div className="listing-share">
    <div className="listing-share-actions">
      {pagePublisher && <Link className="facebook-share facebook-page-publish" href={facebookPublishingUrl(id)}>Post to PinoyBuyNSell Page</Link>}
      <a className="facebook-share" href={listingShareUrl(id)} target="_blank" rel="noopener noreferrer">
        {pagePublisher ? "Share to profile or group ↗" : "Share this item on Facebook ↗"}
      </a>
      <button className="facebook-share" type="button" onClick={copyLink}>Copy listing link</button>
    </div>
    <p className="listing-share-help">{pagePublisher
      ? "Use Post to PinoyBuyNSell Page to publish directly. The next screen lets you review the listing and confirm posting."
      : "If Facebook keeps loading, check for the post first. If it isn’t there, copy the link and paste it into a new Facebook post."}</p>
    {message && <p role="status" className="listing-share-help">{message}</p>}
    {showLink && <label className="listing-share-link">Listing link
      <input type="text" readOnly value={url} onFocus={event => event.currentTarget.select()} />
    </label>}
  </div>;
}
