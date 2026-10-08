"use client";
import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";
import { openIdentityDocument, reviewIdentity, withDeadline } from "@/lib/verification-actions";

export default function AdminVerifications() {
  const [allowed, setAllowed] = useState(false), [items, setItems] = useState([]);
  const [message, setMessage] = useState("Checking administrator access...");
  const [busy, setBusy] = useState(null), [document, setDocument] = useState(null);
  const [notes, setNotes] = useState({}), [feedback, setFeedback] = useState({});
  const [adminId, setAdminId] = useState(null);
  const actionLock = useRef(false);

  async function load() {
    try {
      const auth = await withDeadline(supabase.auth.getUser());
      if (auth.error || !auth.data.user) { setAllowed(false); setMessage("Sign in with your administrator account."); return; }
      setAdminId(auth.data.user.id);
      const check = await withDeadline(supabase.rpc("is_marketplace_admin"));
      if (check.error || !check.data) { setAllowed(false); setMessage("Administrator access required."); return; }
      setAllowed(true);
      const result = await withDeadline(supabase.from("identity_verifications").select("*").eq("status", "pending").order("submitted_at"));
      if (result.error) throw result.error;
      setItems(result.data || []); setMessage("");
    } catch (error) { setMessage(error.message || "Could not load pending verifications."); }
  }
  useEffect(() => { load(); }, []);
  const notify = (id, text) => setFeedback(current => ({ ...current, [id]: text }));

  async function view(item) {
    if (actionLock.current) return;
    actionLock.current = true; setBusy({ id: item.user_id, action: "view" }); setDocument(null);
    notify(item.user_id, "Opening private ID...");
    try {
      const url = await openIdentityDocument(supabase, item.document_path);
      setDocument({ userId: item.user_id, url });
      notify(item.user_id, "Loading ID image...");
    } catch (error) { notify(item.user_id, error.message || "Could not open the ID document."); }
    finally { actionLock.current = false; setBusy(null); }
  }

  async function review(item, decision) {
    if (actionLock.current) return;
    if (item.user_id === adminId) { notify(item.user_id, "Another administrator must review your ID. You cannot approve or reject your own submission."); return; }
    actionLock.current = true; setBusy({ id: item.user_id, action: decision });
    notify(item.user_id, decision === "approved" ? "Approving account..." : "Rejecting submission...");
    try {
      await reviewIdentity(supabase, item.user_id, decision, notes[item.user_id]);
      setItems(current => current.filter(entry => entry.user_id !== item.user_id));
      setDocument(null);
      setMessage(decision === "approved" ? "Account approved successfully." : "Submission rejected. The user can submit a new ID.");
    } catch (error) { notify(item.user_id, error.message || "Review failed. Refresh to check the status before trying again."); }
    finally { actionLock.current = false; setBusy(null); }
  }

  return <><Header /><main className="page"><div className="container narrow">
    <h1>ID approval queue</h1>
    <p>Review the ID and confirm that the name matches before approving. Private ID links expire after one minute.</p>
    {message && <p role="status" aria-live="polite">{message}</p>}
    <button type="button" className="view" disabled={Boolean(busy)} onClick={load}>Refresh queue</button>
    {allowed && items.length === 0 && <p>No pending submissions.</p>}
    {allowed && items.map(item => <article key={item.user_id} className="listing-form" style={{ padding: 20, border: "1px solid #ddd", marginTop: 20 }}>
      <h2>{item.full_name}</h2><p>{item.id_type} · {new Date(item.submitted_at).toLocaleString()}</p>
      <p>User ID: {item.user_id}</p>
      <button type="button" className="view" disabled={Boolean(busy)} onClick={() => view(item)}>
        {busy?.id === item.user_id && busy.action === "view" ? "Opening ID..." : "View private ID"}
      </button>
      {document?.userId === item.user_id && <img src={document.url} alt="Private ID submitted for review" style={{ maxWidth: "100%" }}
        onLoad={() => notify(item.user_id, "ID loaded. Review it before making a decision.")}
        onError={() => { setDocument(null); notify(item.user_id, "The ID image could not load or its link expired. Click View private ID to try again."); }} />}
      {feedback[item.user_id] && <p role="status" aria-live="polite">{feedback[item.user_id]}</p>}
      {item.user_id === adminId && <p>Another administrator must review your ID. Self-approval is disabled.</p>}
      <label>Review note<input maxLength={500} value={notes[item.user_id] || ""} onChange={e => setNotes({ ...notes, [item.user_id]: e.target.value })} /></label>
      <button type="button" className="sell" disabled={Boolean(busy) || item.user_id === adminId} onClick={() => review(item, "approved")}>
        {busy?.id === item.user_id && busy.action === "approved" ? "Approving..." : "Approve account"}
      </button>
      <button type="button" className="view" disabled={Boolean(busy) || item.user_id === adminId} onClick={() => review(item, "rejected")}>
        {busy?.id === item.user_id && busy.action === "rejected" ? "Rejecting..." : "Reject — request a new ID"}
      </button>
    </article>)}
  </div></main></>;
}
