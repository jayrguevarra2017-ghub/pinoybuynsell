"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";

export default function AccountPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);
      setLoading(false);
    }

    loadUser();
  }, [router]);

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

          <div
            style={{
              marginTop: "30px",
              padding: "24px",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
            }}
          >
            <h2>Account Information</h2>

            <p>
              <strong>Email:</strong> {user?.email}
            </p>

            <p>
              <strong>Account ID:</strong> {user?.id}
            </p>
          </div>

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
