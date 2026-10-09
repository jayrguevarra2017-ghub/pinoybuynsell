"use client";

import { useState } from "react";
import { listingShareUrl, listingUrl } from "@/lib/facebook";

export default function ListingShare({ id }) {
  const [message, setMessage] = useState("");
  const [showLink, setShowLink] = useState(false);
  const url = listingUrl(id);

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
      <a className="facebook-share" href={listingShareUrl(id)} target="_blank" rel="noopener noreferrer">Share this item on Facebook ↗</a>
      <button className="facebook-share" type="button" onClick={copyLink}>Copy listing link</button>
    </div>
    <p className="listing-share-help">If Facebook keeps loading, check your Page for the post first. If it isn’t there, copy the link and paste it into a new Page post.</p>
    {message && <p role="status" className="listing-share-help">{message}</p>}
    {showLink && <label className="listing-share-link">Listing link
      <input type="text" readOnly value={url} onFocus={event => event.currentTarget.select()} />
    </label>}
  </div>;
}
