"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteLogo from "@/components/SiteLogo";
import VisitorCounter from "@/components/VisitorCounter";
import { supabase } from "@/lib/supabase";

export default function Header() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

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
    <header className="topbar">
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
            + Sell an Item
          </Link>
        </div>
      </div>
      <div className="container site-activity"><VisitorCounter /></div>
    </header>
  );
}
