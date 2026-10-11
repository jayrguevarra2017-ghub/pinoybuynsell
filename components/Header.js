"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import SiteLogo from "@/components/SiteLogo";
import VisitorCounter from "@/components/VisitorCounter";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";
import AdminAttentionBadge from "@/components/AdminAttentionBadge";
import BidNotificationLink from "@/components/BidNotificationLink";

export default function Header() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef(null), header = useRef(null);
  const app = useApp();

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = event => {
      if (event.type === "keydown" && event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
      if (event.type === "pointerdown" && !header.current?.contains(event.target)) setMenuOpen(false);
    };
    window.addEventListener("keydown", dismiss); window.addEventListener("pointerdown", dismiss);
    return () => { window.removeEventListener("keydown", dismiss); window.removeEventListener("pointerdown", dismiss); };
  }, [menuOpen]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoadingUser(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoadingUser(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  }

  return (
    <header className="topbar" ref={header}>
      <div className="container nav">
        <SiteLogo />

        <nav className="mainnav">
          <Link href="/">Home</Link>
          <Link href="/search">Browse</Link>
          <Link href="/auctions">Auctions</Link>
          <Link href="/#categories">Categories</Link>
          <Link href="/usa-shopping">Buy from USA</Link>
        </nav>

        <div className="actions">
          {!loadingUser &&
            (user ? (
              <>
               <Link className="login" href="/account">
  My Account
  {app?.isAdmin && <AdminAttentionBadge state={app.adminAttention} />}
</Link>
                <button
                  type="button"
                  className="login"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </>
            ) : (
              <Link className="login" href="/login">
                Log in
              </Link>
            ))}

          <Link className="sell" href="/sell">
            {app?.isAdmin ? "+ Sell an Item" : "Selling soon"}
          </Link>
        </div>
      </div>
      <div className="container site-activity">
        <div className="app-header-actions">
          <button ref={menuButton} type="button" className="mobile-menu-toggle" aria-expanded={menuOpen} aria-controls="mobile-site-menu" onClick={() => setMenuOpen(!menuOpen)}><span aria-hidden="true">☰</span> Menu</button>
          {app && !app.installed && <button type="button" className="app-install-button" onClick={app.openInstall}>Install app</button>}
        </div>
        <BidNotificationLink />
        <VisitorCounter />
      </div>
      {app && !app.online && <p className="app-connection-notice" role="status">You’re offline. Reconnect to refresh listings, place bids or send messages.</p>}
      <nav id="mobile-site-menu" className="container mobile-site-menu" aria-label="More mobile links" hidden={!menuOpen}>
        {[ ["Home", "/"], ["Browse", "/search"], ["Auctions", "/auctions"], ["Buy from USA", "/usa-shopping"],
          ["Categories", "/#categories"], ["My account", "/account"], ["Payment & returns", "/payment-rules"], ["Marketplace rules", "/prohibited-items"] ].map(([label, href]) =>
          <Link key={href} href={href} prefetch={false} onClick={() => setMenuOpen(false)}>{label}</Link>)}
      </nav>
    </header>
  );
}
