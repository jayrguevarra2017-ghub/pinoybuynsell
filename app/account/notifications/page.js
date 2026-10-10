"use client";
import Link from "next/link";
import Header from "@/components/Header";
import BidNotifications from "@/components/BidNotifications";
export default function NotificationsPage() {
  return <><Header /><main className="page"><div className="container narrow">
    <p className="eyebrow">YOUR MARKETPLACE ACTIVITY</p><h1>Bid notifications</h1>
    <Link href="/account" className="back">← My account</Link>
    <BidNotifications />
    <p className="muted">Checks update every 30 seconds while the website tab is visible. These are website notices; no email or phone push is sent.</p>
  </div></main></>;
}
