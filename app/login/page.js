"use client";

import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";
import { usaSignInReturn } from "@/lib/usa-items.mjs";
import { runAuthAction } from "@/lib/auth-actions.mjs";

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const lock = useRef(false), active = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const next = usaSignInReturn(new URLSearchParams(window.location.search).get("next"));
        await runAuthAction(supabase, "signup", { email, password,
          redirectTo: `${window.location.origin}/login${next ? `?next=${encodeURIComponent(next)}` : ""}` });
        if (!active.current) return;

        setMessage(
          "Account created. Confirm your email, sign in, then upload your ID at Account Verification to receive bidding approval. You can browse and contact sellers about buying. Selling for members is coming soon."
        );
      } else {
        await runAuthAction(supabase, "login", { email, password });
        if (!active.current) return;

        window.location.href = usaSignInReturn(new URLSearchParams(window.location.search).get("next")) || "/verify";
      }
    } catch (error) {
      if (active.current) setMessage(error.message || "Something went wrong.");
    } finally {
      lock.current = false;
      if (active.current) setLoading(false);
    }
  }
async function handleForgotPassword() {
  if (lock.current) return;
  setMessage("");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    setMessage("Please enter your email address first.");
    return;
  }

  lock.current = true; setLoading(true);

  try {
    await runAuthAction(supabase, "recovery", { email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (!active.current) return;

    setMessage(
      "Password reset email sent! Please check your inbox and spam folder."
    );
  } catch (error) {
    if (active.current) setMessage(error.message || "Unable to send password reset email.");
  } finally {
    lock.current = false;
    if (active.current) setLoading(false);
  }
}
  return (
    <>
      <Header />

      <main className="page">
        <div className="container narrow auth">
          <p className="eyebrow">
            {mode === "login" ? "WELCOME BACK" : "JOIN PINOYBUYNSell"}
          </p>

          <h1>
            {mode === "login" ? "Login to your account" : "Create an account"}
          </h1>

          <p>
            {mode === "login"
              ? "Sign in to buy, sell, bid, and manage your listings."
              : "Create a pending account, confirm your email, and submit a government ID for administrator approval."}
          </p>

          <form onSubmit={handleSubmit}>
            <label>
              Email
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                disabled={loading}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                disabled={loading}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Login"
                : "Create Account"}
            </button>
          </form>
{mode === "login" && (
  <button
    type="button"
    onClick={handleForgotPassword}
    disabled={loading}
  >
    Forgot password?
  </button>
)}

          {message && <p role="status" aria-live="polite">{message}</p>}

          <p>
            {mode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (lock.current) return;
                setMode(mode === "login" ? "signup" : "login");
                setMessage("");
              }}
            >
              {mode === "login" ? "Sign Up" : "Login"}
            </button>
          </p>
        </div>
      </main>
    </>
  );
}
