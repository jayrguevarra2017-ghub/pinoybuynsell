"use client";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { unreadBidCount } from "@/lib/bid-notices.mjs";

export function BidNotificationToast({ state, onDismiss }) {
  if (!state?.notice || state.error) return null;
  const item = state.notice;
  return <aside className="bid-notification-toast" aria-label="New bid notification">
    <p role="status">{item.count > 1 ? `${item.count} new bids on your listings.` : `New bid: ₱${item.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} on “${item.title}”.`}</p>
    <Link href="/account/notifications" onClick={onDismiss}>View bid notifications</Link>
    <button type="button" onClick={onDismiss} aria-label="Dismiss new bid notification">×</button>
  </aside>;
}

export default function BidNotifications({ compact = false }) {
  const app = useApp(), state = app?.bidNotifications;
  if (!app?.authReady) return <p role="status">Checking bid notifications…</p>;
  if (!app.user) return <p><Link href="/login">Sign in</Link> to view your bid notifications.</p>;
  if (compact && !state?.hasListings && !state?.error && state?.ready) return null;
  const count = unreadBidCount(state), busy = state?.refreshing || state?.marking;
  const items = state?.items || [], shown = compact ? items.slice(0, 5) : items;
  return <section className="bid-notifications" aria-labelledby={compact ? "account-bid-notifications" : "recent-bid-notifications"}>
    <h2 id={compact ? "account-bid-notifications" : "recent-bid-notifications"}>Bids on your listings</h2>
    <p>Recent confirmed bids, newest first. Read status is saved to your account.</p>
    {!app.online ? <p role="status">Reconnect to check your bid notifications.</p> : state?.error ? <p role="alert">{state.error}</p>
      : !state?.ready ? <p role="status">Loading bid notifications…</p>
      : <p role="status">{count ? `${count} unread recent bid${count === 1 ? "" : "s"}.` : "No unread recent bids."}</p>}
    <div className="bid-notification-actions">
      <button type="button" className="view inline" disabled={!app.online || busy} onClick={app.refreshBidNotifications}>{state?.refreshing ? "Refreshing…" : "Refresh bid notifications"}</button>
      <button type="button" className="view inline" disabled={!app.online || busy || state?.error || !count}
        onClick={() => app.markBidNotificationsRead(items.filter(item => !item.read).map(item => item.id))}>{state?.marking ? "Saving read status…" : "Mark recent bids as read"}</button>
    </div>
    {state?.ready && !items.length && !state.error && <p>No bids have been received on your listings yet.</p>}
    <ol className="bid-notification-list">{shown.map(item => <li key={item.id} className={item.read ? "bid-notice-read" : "bid-notice-unread"}>
      <div><strong>{item.read ? "Bid received" : "New bid"}: ₱{item.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong>
        <Link href={`/product/${item.listingId}`}>{item.title}</Link>
        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Philippine time)</time>
      </div>
      {!item.read && <button type="button" disabled={!app.online || busy || state.error} onClick={() => app.markBidNotificationsRead([item.id])} aria-label={`Mark bid ${item.id} as read`}>Mark as read</button>}
    </li>)}</ol>
    {compact && <Link href="/account/notifications" className="view">View all recent bid notifications</Link>}
    {!compact && state?.hasMore && <p>Showing the latest 50 bids. Older bids are outside this notification view.</p>}
  </section>;
}
