"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Password updated successfully!");

    setTimeout(() => {
      router.push("/login");
    }, 1500);
  }

  return (
    <>
      <Header />

      <main className="page">
        <div className="container narrow auth">
          <p className="eyebrow">ACCOUNT RECOVERY</p>

          <h1>Create a new password</h1>

          <p>
            Enter a new password for your PinoyBuyNSell account.
          </p>

          <form onSubmit={handleSubmit}>
            <div>
              <label>New Password</label>
              <input
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>

          {message && <p>{message}</p>}
        </div>
      </main>
    </>
  );
}
