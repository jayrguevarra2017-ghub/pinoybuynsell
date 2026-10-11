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
import BidNotifications from "@/components/BidNotifications";
import ListingManagementActions from "@/components/ListingManagementActions";
import { managementListingFields } from "@/lib/listing-management.mjs";
import { listingAvailability } from "@/lib/listing-order.mjs";

export default function AccountPage() {
  const app = useApp();
  return <AccountContent key={app?.user?.id || "guest"} />;
}

function AccountContent() {
  const router = useRouter();
  const app = useApp();

  const [listings, setListings] = useState([]);
  const [listingsError, setListingsError] = useState("");
  const [listingsMessage, setListingsMessage] = useState("");
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
      setLoading(true); setProfileReady(false); setProfileError(""); setAccountError(""); setMessage(""); setListingsMessage("");
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
          withDeadline(supabase.from("products").select(managementListingFields).eq("seller_id", account.id).order("created_at", { ascending: false }))
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

      <main className="page account-main">
        <div className="container account-page">
          <div className="account-heading">
            <div><p className="eyebrow">PINOYBUYSELL</p><h1>My account</h1></div>
            <div className="account-quick-links">
              <Link className="view inline" href="/verify">ID verification</Link>
              <Link className="view inline" href="/usa-shopping">USA shopping</Link>
              {sellerUrl(user?.id) && listings.some(item => !item.deleted_at && ["active", "sold"].includes(item.status)) &&
                <Link className="view inline" href={sellerUrl(user.id)}>Seller profile</Link>}
            </div>
          </div>
          <div className="account-dashboard">
            <AdminAccountLinks />
            <BidNotifications compact />
          </div>
          {!app?.adminReady ? <p>Checking selling access…</p> : app.adminError ? <>
            <p role="alert">{app.adminError}</p><button type="button" onClick={app.refreshAdminAccess}>Retry selling access check</button>
          </> : !app.isAdmin && <SellingComingSoon />}
          <div className="account-secondary-panels">
            <details className="account-panel account-following-panel">
              <summary><strong>Sellers you follow</strong><span>View followed sellers</span></summary>
              <FollowedSellers />
            </details>

          {profileError && <div role="alert"><p>{profileError}</p>
            <button type="button" disabled={saving} onClick={() => setRevision(value => value + 1)}>Retry profile loading</button>
          </div>}
          <details className="account-panel account-profile-panel">
            <summary><strong>Profile information</strong><span>Edit your details</span></summary>
            <form className="account-profile-form" onSubmit={handleSave}>
              <p className="account-email"><strong>Email:</strong> {user?.email}</p>
              <fieldset className="account-profile-fields" disabled={!profileReady || saving}>
                <legend className="sr-only">Profile information</legend>
                {[
                  { name: "username", id: "profile-username", label: "Username", placeholder: "Username" },
                  { name: "full_name", id: "profile-full-name", label: "Full name", placeholder: "Full name" },
                  { name: "phone", id: "profile-phone", label: "Phone", placeholder: "Phone number", type: "tel" },
                  { name: "location", id: "profile-location", label: "Location", placeholder: "City / Province" },
                ].map(field => <label key={field.name} htmlFor={field.id}>{field.label}
                  <input type={field.type || "text"} name={field.name} id={field.id} value={profile[field.name]}
                    onChange={handleChange} placeholder={field.placeholder} />
                </label>)}
              </fieldset>
              <small>Your username appears on your seller profile and recommendations.</small>
              <button type="submit" disabled={saving || !profileReady}>{saving ? "Saving..." : "Save Profile"}</button>
              {message && <p role="status"><strong>{message}</strong></p>}
            </form>
          </details>
          </div>

          <section className="account-listings" aria-labelledby="my-listings">
            <div className="account-section-heading">
              <h2 id="my-listings">My listings <span className="account-listing-count" aria-hidden="true">{listingsError ? "" : listings.length}</span></h2>
              <button type="button" className="view inline" disabled={!app?.online || saving} onClick={() => setRevision(value => value + 1)}>Refresh my listings</button>
            </div>
            {listingsMessage && <p role="status">{listingsMessage}</p>}
            {app?.isAdmin && <p className="muted account-listings-help">Relist creates a fresh listing and keeps the old bids. Delete hides the listing.</p>}
            {listingsError ? <p role="alert">{listingsError}</p> : listings.length === 0 ? <p>You have no listings yet.</p> : listings.map((item) => (
              <article key={item.id} className="account-listing-card">
                <Link className="account-listing-thumbnail" href={`/product/${item.id}`} aria-label={`View ${item.title}`}>
                  <ListingPhoto product={item} fit="contain" />
                </Link>
                <div className="account-listing-info">
                <h3><Link href={`/product/${item.id}`}>{item.title}</Link></h3>
                <p>₱{Number(item.price).toLocaleString("en-PH")} · {item.deleted_at ? "Deleted" : listingAvailability(item).label}</p>
                {item.listing_type && <p>{item.listing_type === "auction" ? "Auction / bidding · one item or lot" : `Fixed price · ${item.quantity} available${item.variations?.length ? ` · ${item.variations.length} variations` : ""}`}</p>}
                <ShippingDetails product={item} />
                <div className="account-listing-links">
                  <Link className="view inline" href={`/product/${item.id}`}>View listing</Link>
                  {item.deleted_at ? <p className="muted">Removed by administrator</p> : app?.isAdmin && <Link className="view inline" href={`/account/listings/${item.id}/edit`}>Edit listing</Link>}
                </div>
                <ListingManagementActions key={`${item.id}:${item.deleted_at || "active"}`} product={item}
                  onDeleted={deleted => { setListings(current => current.map(row => String(row.id) === String(deleted.id) ? deleted : row)); setListingsMessage("Listing deleted from the marketplace. Auction and bid records were retained."); }}
                  onRefresh={() => setRevision(value => value + 1)} />
                </div>
              </article>
            ))}
          </section>

          <div className="account-footer-actions">
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
