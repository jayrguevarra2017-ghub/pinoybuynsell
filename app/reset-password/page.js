"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";
import { withDeadline } from "@/lib/verification-actions";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const lock = useRef(false), redirectTimer = useRef(null);
  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (lock.current || completed) return;
    setMessage("");

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    lock.current = true; setLoading(true);
    try {
      const { error } = await withDeadline(supabase.auth.updateUser({ password }));
      if (error) { setMessage(error.message || "This reset link could not be used. Request another email from the login page."); return; }
      setCompleted(true); setMessage("Password updated successfully!");
      redirectTimer.current = setTimeout(() => { router.replace("/login"); }, 1500);
    } catch {
      setMessage("Could not confirm the password update. Try signing in with your new password before requesting another reset.");
    } finally { lock.current = false; setLoading(false); }
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
              <label htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                disabled={loading || completed}
                required
              />
            </div>

            <div>
              <label htmlFor="confirm-password">Confirm Password</label>
              <input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading || completed}
                required
              />
            </div>

            <button type="submit" disabled={loading || completed}>
              {loading ? "Updating..." : completed ? "Password updated" : "Update Password"}
            </button>
          </form>

          {message && <p role="status">{message}</p>}
          <Link className="view" href="/login">Return to login</Link>
        </div>
      </main>
    </>
  );
}
