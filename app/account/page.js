"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ListingPhoto from "@/components/ListingPhoto";
import ShippingDetails from "@/components/ShippingDetails";
import AdminAccountLinks from "@/components/AdminAccountLinks";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";

export default function AccountPage() {
  const router = useRouter();

  const [listings, setListings] = useState([]);
  const [listingsError, setListingsError] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [profile, setProfile] = useState({
    username: "",
    full_name: "",
    phone: "",
    location: "",
  });

  useEffect(() => {
    async function loadAccount() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      const { data, error } = await supabase
        .from("profiles")
        .select("username, full_name, phone, location")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setProfile({
          username: data.username || "",
          full_name: data.full_name || "",
          phone: data.phone || "",
          location: data.location || "",
        });
      }

      try {
        const { data: items, error: itemsError } = await supabase.from("products")
          .select("*").eq("seller_id", user.id).order("created_at", { ascending: false });
        if (itemsError) throw itemsError;
        setListings(items || []);
      } catch {
        setListingsError("Could not load your listings. Please refresh to try again.");
      }
      setLoading(false);
    }

    loadAccount();
  }, [router]);

  function handleChange(event) {
    const { name, value } = event.target;

    setProfile((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!user) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        username: profile.username.trim(),
        full_name: profile.full_name.trim(),
        phone: profile.phone.trim(),
        location: profile.location.trim(),
      })
      .eq("id", user.id);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Profile saved successfully!");
    }

    setSaving(false);
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

  return (
    <>
      <Header />

      <main className="page">
        <div className="container narrow auth">
          <p className="eyebrow">MY ACCOUNT</p>

          <h1>Welcome to PinoyBuyNSell</h1>

          <p>Manage your account and marketplace activity.</p>
          <Link className="view" href="/verify">ID verification and approval status</Link>
          <Link className="view" href="/usa-shopping">Request USA shopping assistance</Link>

          <AdminAccountLinks />

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
              <label>
                <strong>Username</strong>
              </label>
              <input
                type="text"
                name="username"
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

              <label>
                <strong>Full Name</strong>
              </label>
              <input
                type="text"
                name="full_name"
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

              <label>
                <strong>Phone</strong>
              </label>
              <input
                type="tel"
                name="phone"
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

              <label>
                <strong>Location</strong>
              </label>
              <input
                type="text"
                name="location"
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

            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </button>

            {message && (
              <p style={{ marginTop: "15px" }}>
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
                <ShippingDetails product={item} />
                <Link className="view" href={`/product/${item.id}`}>View listing</Link>
                {item.deleted_at ? <p>Removed by administrator</p> : <Link className="view" href={`/account/listings/${item.id}/edit`}>Edit listing</Link>}
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
            <button onClick={() => router.push("/sell")}>
              Sell an Item
            </button>

            <button onClick={() => router.push("/")}>
              Browse Marketplace
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
