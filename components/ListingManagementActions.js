"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { supabase } from "@/lib/supabase";
import { canRelistListing, deleteAdminListing } from "@/lib/listing-management.mjs";

export default function ListingManagementActions({ product, onDeleted, onRefresh }) {
  const app = useApp();
  const [confirming, setConfirming] = useState(false), [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [needsRefresh, setNeedsRefresh] = useState(false);
  const lock = useRef(false);
  if (!app?.isAdmin || product.deleted_at) return null;
  const disabled = busy || !app.online || needsRefresh;
  async function remove(event) {
    event.preventDefault();
    if (lock.current || disabled || !reason.trim()) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const result = await deleteAdminListing(supabase, product.id, reason);
      setConfirming(false); setReason("");
      onDeleted({ ...product, deleted_at: result.deleted_at });
    } catch (error) {
      setMessage(error.message || "Could not confirm deletion. Refresh listings before retrying.");
      setNeedsRefresh(true);
    } finally { lock.current = false; setBusy(false); }
  }
  return <div className="listing-management-actions">
    <div className="listing-share-actions">
      {canRelistListing(product, app.user?.id) && app.online && !busy && !needsRefresh &&
        <Link className="view inline" href={`/account/listings/${product.id}/relist`}>Relist</Link>}
      <button type="button" className="view inline" disabled={disabled} onClick={() => { setConfirming(true); setMessage(""); }}>Delete listing</button>
    </div>
    {!app.online && <p>Reconnect before managing this listing.</p>}
    {confirming && <form className="listing-delete-confirm" onSubmit={remove} aria-label={`Confirm deletion of ${product.title}`}>
      <h4>Delete “{product.title}”?</h4>
      <p>This hides the listing from buyers and stops bidding. Its photos and auction/bid history stay saved. There is no restore button.</p>
      <label>Reason for deletion
        <textarea required maxLength={500} value={reason} disabled={disabled} onChange={event => setReason(event.target.value)} />
      </label>
      <div className="listing-share-actions">
        <button type="submit" className="sell inline" disabled={disabled || !reason.trim()}>{busy ? "Deleting…" : "Confirm delete listing"}</button>
        <button type="button" className="view inline" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
      </div>
    </form>}
    {message && <p role="alert">{message}</p>}
    {needsRefresh && <button type="button" className="view" disabled={busy || !app.online} onClick={onRefresh}>Refresh listings to check result</button>}
  </div>;
}
