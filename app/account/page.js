"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";

export default function AccountPage() {
  const router = useRouter();

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
