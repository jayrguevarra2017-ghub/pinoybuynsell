"use client";
import Link from "next/link";
import Header from "@/components/Header";
import { useApp } from "@/components/AppProvider";
export default function PaymentAccountGate({ children, admin = false }) {
 const app = useApp();
 return <><Header /><main className="page"><div className="container narrow payments-page">
 {!app?.authReady || (admin && !app.adminReady) ? <p>Checking account…</p> : !app.user ? <p><Link href="/login">Sign in</Link> to manage orders.</p>
 : admin && !app.isAdmin ? <p>Administrator access is required. {app.adminError}</p> : children}
 </div></main></>;
}
