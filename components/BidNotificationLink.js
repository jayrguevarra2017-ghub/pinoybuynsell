"use client";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { unreadBidCount } from "@/lib/bid-notices.mjs";

export default function BidNotificationLink() {
  const app = useApp(), state = app?.bidNotifications;
  if (!app?.user || (!state?.hasListings && !state?.error)) return null;
  const count = unreadBidCount(state);
  return <Link href="/account/notifications" className="bid-notification-link" prefetch={false}
    aria-label={state.error ? "Bid notifications unavailable. Open to retry." : `Bid notifications${count === null ? "" : `: ${count} unread recent bids`}`}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
    <span>Bid notices</span>
    {state.error ? <span className="bid-notification-count">!</span> : count > 0 && <span className="bid-notification-count">{count}</span>}
  </Link>;
}
