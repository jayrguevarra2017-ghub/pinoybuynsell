"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PaymentAccountGate from "@/components/PaymentAccountGate";
import { useApp } from "@/components/AppProvider";
import { supabase } from "@/lib/supabase";
import { paymentRPC } from "@/lib/marketplace-payments.mjs";
import { withDeadline } from "@/lib/verification-actions.js";
function Settings({ userId }) {
 const [details, setDetails] = useState({}), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [revision, setRevision] = useState(0);
 const life = useRef(null), lock = useRef(false);
 useEffect(() => { const c = new AbortController(); life.current = c; return () => c.abort(); }, []);
 useEffect(() => { const c = new AbortController(); setReady(false); setMessage("");
  withDeadline(supabase.from("marketplace_payment_settings").select("details").eq("seller_id", userId).maybeSingle().abortSignal(c.signal)).then(r => {
   if (r.error) throw Error("Payment settings are unavailable. Install the payment database update first.");
   if (!c.signal.aborted) { setDetails(r.data?.details || {}); setReady(true); }
  }).catch(e => { if (!c.signal.aborted) setMessage(e.message); }); return () => c.abort();
 }, [userId, revision]);
 async function save(e) { e.preventDefault(); if (lock.current || !ready) return; lock.current = true; setBusy(true); setMessage("");
  try { const saved = await paymentRPC(supabase, "set_marketplace_payment_settings", { p_details: details }, life.current.signal);
   if (!life.current.signal.aborted) { if (!saved || !Object.keys(saved).length) throw Error("Save could not be confirmed."); setDetails(saved); setMessage("Payment details saved. New orders will use these details; existing orders keep their original payment instructions."); }
  } catch(e) { if (!life.current.signal.aborted) setMessage(`${e.message} Reload to check whether the save completed.`); }
  finally { if (!life.current.signal.aborted) { lock.current = false; setBusy(false); } }
 }
 function update(method, key, value) { setDetails(d => ({ ...d, [method]: { ...d[method], [key]: value } })); }
 return <><h1>My payment details</h1><p>Enter the GCash or bank account you receive payments into. Only buyers who place an order and authorized administrators can see an order’s payment instructions. Never enter a PIN or password.</p>
 <form onSubmit={save}><fieldset disabled={!ready || busy}><legend>Accepted methods</legend>{[["gcash","GCash"],["bank_deposit","Bank deposit"]].map(([m,label]) => <section key={m}>
 <label className="payment-check"><input type="checkbox" checked={Boolean(details[m])} onChange={e => setDetails(d => { const next = { ...d }; if (e.target.checked) next[m] = { name: "", account: "", ...(m === "bank_deposit" ? { bank: "" } : {}) }; else delete next[m]; return next; })} />{label}</label>
 {details[m] && <><label>Account name<input required maxLength={120} value={details[m].name || ""} onChange={e => update(m,"name",e.target.value)} /></label>
 {m === "bank_deposit" && <label>Bank name<input required maxLength={100} value={details[m].bank || ""} onChange={e => update(m,"bank",e.target.value)} /></label>}
 <label>{m === "gcash" ? "GCash mobile number" : "Bank account number"}<input required maxLength={100} value={details[m].account || ""} autoComplete="off" onChange={e => update(m,"account",e.target.value)} /></label></>}
 </section>)}<button disabled={busy || !Object.keys(details).length}>Save payment details</button></fieldset></form>
 {message && <p role="status">{message}</p>}<button disabled={busy} onClick={() => setRevision(v => v+1)}>Reload saved details</button><p><Link href="/account/orders">Orders and sales</Link></p></>;
}
export default function Page() { const app = useApp(); return <PaymentAccountGate admin>{app?.isAdmin && <Settings key={app.user.id} userId={app.user.id} />}</PaymentAccountGate>; }
