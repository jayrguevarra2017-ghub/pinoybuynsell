"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useApp } from "@/components/AppProvider";
import { supabase } from "@/lib/supabase";
import { photoTypes, validatePhoto } from "@/lib/listing-photo-format.mjs";
import { readIdentityStatus, submitIdentity } from "@/lib/identity-verification.mjs";

export default function VerificationPage() {
  const app = useApp();
  return <><Header/><main className="page"><div className="container narrow">
    <h1>Account verification</h1>
    <p>Upload a clear government-issued ID matching your name. An administrator must approve your account before bidding. Selling and listing posts are currently available to administrators; selling for members is coming soon. Verification does not guarantee another user's trustworthiness.</p>
    {!app?.authReady ? <p>Checking sign-in…</p> : !app.user ? <Link href="/login">Sign in to verify your account</Link>
      : <VerificationForm key={app.user.id} userId={app.user.id}/>}
    <Link className="view" href="/account">My account</Link>
  </div></main></>;
}

function VerificationForm({ userId }) {
  const [record, setRecord] = useState(null), [loading, setLoading] = useState(true), [available, setAvailable] = useState(false);
  const [name, setName] = useState(""), [type, setType] = useState(""), [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [readError, setReadError] = useState("");
  const lock = useRef(false), life = useRef(null), read = useRef(null);
  const load = useCallback(async () => {
    if (lock.current) return;
    read.current?.abort();
    const controller = new AbortController(); read.current = controller;
    setLoading(true); setAvailable(false); setReadError("");
    try {
      const status = await readIdentityStatus(supabase, userId, { signal: controller.signal });
      if (!controller.signal.aborted) { setRecord(status); setAvailable(true); }
    } catch (error) { if (!controller.signal.aborted) setReadError(error.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [userId]);
  useEffect(() => {
    const controller = new AbortController(); life.current = controller;
    load();
    return () => { controller.abort(); read.current?.abort(); };
  }, [load]);

  async function submit(event) {
    event.preventDefault(); if (lock.current || !available || life.current.signal.aborted) return;
    const error = validatePhoto(file);
    if (!file || error || !Object.hasOwn(photoTypes, file.type)) { setMessage(error || "Choose a JPEG, PNG or WebP ID photo up to 5 MB."); return; }
    lock.current = true; setBusy(true); setMessage("");
    const controller = life.current;
    try {
      await submitIdentity(supabase, userId, { name, type, file }, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setFile(null); setRecord({ status: "pending" });
        setMessage("ID submitted. Your account is pending administrator approval.");
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setAvailable(false); setReadError("Refresh your verification status before submitting again."); setMessage(error.message);
      }
    } finally { lock.current = false; if (!controller.signal.aborted) setBusy(false); }
  }
  return <>
    {loading ? <p role="status">Loading verification…</p> : !available ? <p role="status">{readError}</p> : <>
      <p>Status: <strong>{record?.status || "ID required"}</strong></p>
      {record?.review_note && <p>Review note: {record.review_note}</p>}
      {(!record || record.status === "rejected") && <form className="listing-form" onSubmit={submit}>
        <fieldset disabled={busy} className="verification-fields" aria-label="Government ID submission">
          <label>Full name as shown on ID<input required minLength={2} maxLength={150} value={name} onChange={e => setName(e.target.value)}/></label>
          <label>ID type<select required value={type} onChange={e => setType(e.target.value)}><option value="">Choose ID type</option>{["PhilSys ID", "Passport", "Driver license", "Other government ID"].map(t => <option key={t}>{t}</option>)}</select></label>
          <label>ID photo<input type="file" required accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)}/></label>
          <p>JPEG, PNG or WebP, up to 5 MB. This document is private and accessible to verification administrators, not displayed on listings. Do not upload anyone else's ID.</p>
          <label><input type="checkbox" required/> I agree to submit this document for administrator review of my marketplace account.</label>
          <button className="sell" disabled={busy}>{busy ? "Submitting…" : "Submit ID for approval"}</button>
        </fieldset>
      </form>}
    </>}
    <button type="button" className="view" disabled={loading || busy} onClick={() => { setMessage(""); load(); }}>Refresh verification status</button>
    {message && <p role="status" aria-live="polite">{message}</p>}
  </>;
}
