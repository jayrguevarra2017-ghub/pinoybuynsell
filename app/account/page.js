"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ListingPhoto from "@/components/ListingPhoto";
import ShippingDetails from "@/components/ShippingDetails";
import AdminAccountLinks from "@/components/AdminAccountLinks";
import Header from "@/components/Header";
import FollowedSellers from "@/components/FollowedSellers";
import { sellerUrl } from "@/lib/seller-community.mjs";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";
import SellingComingSoon from "@/components/SellingComingSoon";
import { readAccountProfile, saveAccountProfile } from "@/lib/account-profile.mjs";
import { withDeadline } from "@/lib/verification-actions";

export default function AccountPage() {
  const app = useApp();
  return <AccountContent key={app?.user?.id || "guest"} />;
}

function AccountContent() {
  const router = useRouter();
  const app = useApp();

  const [listings, setListings] = useState([]);
  const [listingsError, setListingsError] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [profileReady, setProfileReady] = useState(false), [profileError, setProfileError] = useState("");
  const [accountError, setAccountError] = useState(""), [revision, setRevision] = useState(0);
  const saveLock = useRef(false);

  const [profile, setProfile] = useState({
    username: "",
    full_name: "",
    phone: "",
    location: "",
  });

  useEffect(() => {
    let active = true;
    async function loadAccount() {
      setLoading(true); setProfileReady(false); setProfileError(""); setAccountError(""); setMessage("");
      try {
        const auth = await withDeadline(supabase.auth.getUser());
        if (!active) return;
        if (auth.error) throw auth.error;
        const account = auth.data?.user;
        if (!account) { router.replace("/login"); return; }
        setUser(account);
        await Promise.all([
          readAccountProfile(supabase, account.id).then(data => {
            if (active) { setProfile(data); setProfileReady(true); }
          }).catch(() => { if (active) setProfileError("Your profile could not be loaded. Retry before editing."); }),
          withDeadline(supabase.from("products").select("*").eq("seller_id", account.id).order("created_at", { ascending: false }))
            .then(result => {
              if (result.error) throw result.error;
              if (active) { setListings(result.data || []); setListingsError(""); }
            }).catch(() => { if (active) setListingsError("Could not load your listings. Please refresh to try again."); }),
        ]);
      } catch {
        if (active) setAccountError("Your account could not be loaded. Please try again.");
      } finally { if (active) setLoading(false); }
    }

    loadAccount();
    return () => { active = false; };
  }, [router, revision]);

  function handleChange(event) {
    const { name, value } = event.target;

    setProfile((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!user || !profileReady || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setMessage("");

    try {
      await saveAccountProfile(supabase, user.id, profile);
      setMessage("Profile saved successfully!");
    } catch {
      setMessage("Could not confirm your profile save. Refresh your account to check before trying again.");
    } finally { saveLock.current = false; setSaving(false); }
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="page">
          <div className="container narrow">
            <p>Loading your account...</p>
          </div>
        </main>
      </>
    );
  }

  if (accountError || !user) return <><Header /><main className="page"><div className="container narrow">
    <h1>My account</h1><p role="alert">{accountError || "Sign in to view your account."}</p>
    <button type="button" onClick={() => setRevision(value => value + 1)}>Retry account loading</button>
    <Link className="view" href="/login">Sign in</Link>
  </div></main></>;

  return (
    <>
      <Header />

      <main className="page">
        <div className="container narrow auth account-page">
          <p className="eyebrow">MY ACCOUNT</p>

          <h1>Welcome to PinoyBuyNSell</h1>

          <p>Manage your account and marketplace activity.</p>
          <Link className="view" href="/verify">ID verification and approval status</Link>
          <Link className="view" href="/usa-shopping">Request USA shopping assistance</Link>

          <AdminAccountLinks />
          {!app?.adminReady ? <p>Checking selling access…</p> : app.adminError ? <>
            <p role="alert">{app.adminError}</p><button type="button" onClick={app.refreshAdminAccess}>Retry selling access check</button>
          </> : !app.isAdmin && <SellingComingSoon />}
          {sellerUrl(user?.id) && listings.some(item => !item.deleted_at && ["active", "sold"].includes(item.status)) &&
            <Link className="view" href={sellerUrl(user.id)}>My public seller profile</Link>}
          <FollowedSellers />

          {profileError && <div role="alert"><p>{profileError}</p>
            <button type="button" disabled={saving} onClick={() => setRevision(value => value + 1)}>Retry profile loading</button>
          </div>}
          <form
            onSubmit={handleSave}
            style={{
              marginTop: "30px",
              padding: "24px",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
            }}
          >
            <h2>Profile Information</h2>

            <p>
              <strong>Email:</strong> {user?.email}
            </p>

            <div style={{ marginTop: "20px" }}>
              <label htmlFor="profile-username">
                <strong>Username</strong>
              </label>
              <input
                type="text"
                name="username"
                id="profile-username"
                disabled={!profileReady || saving}
                value={profile.username}
                onChange={handleChange}
                placeholder="Username"
                style={{
                  width: "100%",
                  padding: "12px",
                  marginTop: "6px",
                  marginBottom: "16px",
                }}
              />
              <small>Your username appears on your seller profile and recommendations.</small>

              <label htmlFor="profile-full-name">
                <strong>Full Name</strong>
              </label>
              <input
                type="text"
                name="full_name"
                id="profile-full-name"
                disabled={!profileReady || saving}
                value={profile.full_name}
                onChange={handleChange}
                placeholder="Full name"
                style={{
                  width: "100%",
                  padding: "12px",
                  marginTop: "6px",
                  marginBottom: "16px",
                }}
              />

              <label htmlFor="profile-phone">
                <strong>Phone</strong>
              </label>
              <input
                type="tel"
                name="phone"
                id="profile-phone"
                disabled={!profileReady || saving}
                value={profile.phone}
                onChange={handleChange}
                placeholder="Phone number"
                style={{
                  width: "100%",
                  padding: "12px",
                  marginTop: "6px",
                  marginBottom: "16px",
                }}
              />

              <label htmlFor="profile-location">
                <strong>Location</strong>
              </label>
              <input
                type="text"
                name="location"
                id="profile-location"
                disabled={!profileReady || saving}
                value={profile.location}
                onChange={handleChange}
                placeholder="City / Province"
                style={{
                  width: "100%",
                  padding: "12px",
                  marginTop: "6px",
                  marginBottom: "20px",
                }}
              />
            </div>

            <button type="submit" disabled={saving || !profileReady}>
              {saving ? "Saving..." : "Save Profile"}
            </button>

            {message && (
              <p role="status" style={{ marginTop: "15px" }}>
                <strong>{message}</strong>
              </p>
            )}
          </form>

          <section style={{ marginTop: "30px" }} aria-labelledby="my-listings">
            <h2 id="my-listings">My listings</h2>
            {listingsError ? <p role="alert">{listingsError}</p> : listings.length === 0 ? <p>You have no listings yet.</p> : listings.map((item) => (
              <article key={item.id} style={{ padding: "20px", border: "1px solid #e5e7eb", borderRadius: "12px", marginBottom: "16px" }}>
                <ListingPhoto product={item} detail />
                <h3>{item.title}</h3>
                <p>₱{Number(item.price).toLocaleString("en-PH")} · {item.status}</p>
                {item.listing_type && <p>{item.listing_type === "auction" ? "Auction / bidding · one item or lot" : `Fixed price · ${item.quantity} available${item.variations?.length ? ` · ${item.variations.length} variations` : ""}`}</p>}
                <ShippingDetails product={item} />
                <Link className="view" href={`/product/${item.id}`}>View listing</Link>
                {item.deleted_at ? <p>Removed by administrator</p> : app?.isAdmin && <Link className="view" href={`/account/listings/${item.id}/edit`}>Edit listing</Link>}
              </article>
            ))}
          </section>

          <div
            style={{
              marginTop: "20px",
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            {app?.isAdmin && <button onClick={() => router.push("/sell")}>
              Sell an Item
            </button>}

            <button onClick={() => router.push("/")}>
              Browse Marketplace
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
