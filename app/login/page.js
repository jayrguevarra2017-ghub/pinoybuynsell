"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });

        if (error) throw error;

        setMessage(
          "Account created. Confirm your email, sign in, then upload your ID at Account Verification to receive bidding approval. You can browse and contact sellers about buying. Selling for members is coming soon."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        window.location.href = "/verify";
      }
    } catch (error) {
      setMessage(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }
async function handleForgotPassword() {
  setMessage("");

  if (!email) {
    setMessage("Please enter your email address first.");
    return;
  }

  setLoading(true);

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;

    setMessage(
      "Password reset email sent! Please check your inbox and spam folder."
    );
  } catch (error) {
    setMessage(error.message || "Unable to send password reset email.");
  } finally {
    setLoading(false);
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

          {message && <p>{message}</p>}

          <p>
            {mode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}

            <button
              type="button"
              onClick={() => {
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
