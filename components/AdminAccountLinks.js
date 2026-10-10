"use client";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";

export default function AdminAccountLinks() {
  const app = useApp();
  if (!app?.isAdmin) return null;
  return <section className="account-admin-tools" aria-label="Administrator tools">
    <h2>Administrator tools</h2>
    <Link className="view" href="/sell">Sell an item</Link>
    <Link className="view" href="/admin/verifications">Administrator verification queue</Link>
    <Link className="view" href="/admin/support">Administrator support inbox</Link>
    <Link className="view" href="/admin/listings">Administrator listing management</Link>
    <Link className="view" href="/admin/facebook">Post your listings to Facebook</Link>
    <Link className="view" href="/admin/usa-requests">Administrator USA shopping requests</Link>
  </section>;
}
