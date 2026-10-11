"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import PaymentAccountGate from "@/components/PaymentAccountGate";
import PaymentRules from "@/components/PaymentRules";
import { supabase } from "@/lib/supabase";
import { paymentRPC, paymentMoney, paymentMethodNames } from "@/lib/marketplace-payments.mjs";
function Checkout() {
 const app = useApp(), query = useSearchParams();
 return <PaymentAccountGate>{app?.user && <CheckoutForm key={`${app.user.id}:${query.get("listing")}`} listingId={query.get("listing")} />}</PaymentAccountGate>;
}
function CheckoutForm({ listingId }) {
 const [preview, setPreview] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
 const [quantity, setQuantity] = useState(1), [variation, setVariation] = useState(""), [revision, setRevision] = useState(0);
 const requestKey = useRef(null), lock = useRef(false), life = useRef(null), router = useRouter();
 useEffect(() => { const c = new AbortController(); life.current = c; return () => c.abort(); }, []);
 useEffect(() => {
  const c = new AbortController(); setPreview(null); setError("");
  paymentRPC(supabase, "marketplace_checkout_preview", { p_listing_id: listingId || "" }, c.signal).then(data => {
   if (!c.signal.aborted) { if (!data?.id || !Array.isArray(data.methods) || !Number.isFinite(Number(data.unit_price))) throw Error("Could not load checkout."); setPreview(data); }
  }).catch(e => { if (!c.signal.aborted) setError(e.message); });
  return () => c.abort();
 }, [listingId, revision]);
 async function place(event) {
  event.preventDefault(); if (lock.current || !preview) return;
  lock.current = true; setBusy(true); setError(""); requestKey.current ||= crypto.randomUUID();
  const form = new FormData(event.currentTarget);
  try {
   const order = await paymentRPC(supabase, "create_marketplace_order", { p_listing_id: String(preview.id), p_quantity: Number(quantity), p_variation: variation || null,
    p_recipient_name: form.get("recipient"), p_phone: form.get("phone"), p_address: form.get("address"), p_request_key: requestKey.current }, life.current.signal);
   if (!life.current.signal.aborted) {
    if (!order?.id || String(order.product_id) !== String(preview.id)) throw Error("Order response could not be confirmed.");
    router.push(`/account/orders?order=${encodeURIComponent(order.id)}`);
   }
  } catch(e) { if (!life.current.signal.aborted) setError(`${e.message} Check My orders before placing another order; a timed-out request may have succeeded.`); }
  finally { if (!life.current.signal.aborted) { lock.current = false; setBusy(false); } }
 }
 const stock = preview?.variations?.length ? preview.variations.find(v => v.name === variation)?.quantity || 0 : preview?.available || 0;
 return <><h1>Checkout</h1><p><Link href="/account/orders">My orders</Link></p>
 {error && <p role="alert">{error}</p>}
 {!preview ? <button onClick={() => setRevision(v => v+1)}>Reload checkout</button> : <>
 <h2>{preview.title}</h2><p>{paymentMoney(preview.unit_price)} each · {preview.shipping_carrier}: {paymentMoney(preview.shipping_fee)}</p>
 <p>Payment methods: {preview.methods.map(m => paymentMethodNames[m]).join(" or ")}. Payment details appear after you place the order.</p>
 <form onSubmit={place}><fieldset disabled={busy}><legend>Order and delivery details</legend>
 {preview.variations?.length > 0 && <label>Variation<select value={variation} required onChange={e => { setVariation(e.target.value); setQuantity(1); requestKey.current = null; }}>
 <option value="">Choose variation</option>{preview.variations.map(v => <option key={v.name} value={v.name} disabled={v.quantity < 1}>{v.name} ({v.quantity} available)</option>)}</select></label>}
 <label>Quantity<input type="number" min="1" max={stock || 1} step="1" required value={quantity} disabled={preview.listing_type === "auction"} onChange={e => { setQuantity(e.target.value); requestKey.current = null; }} /></label>
 <p>Available: {stock} · Total including shipping: <strong>{paymentMoney(Number(preview.unit_price)*Number(quantity)+Number(preview.shipping_fee))}</strong></p>
 <label>Recipient name<input name="recipient" autoComplete="name" required maxLength={120} /></label>
 <label>Phone<input name="phone" type="tel" autoComplete="tel" required minLength={5} maxLength={50} /></label>
 <label>Delivery address<textarea name="address" autoComplete="street-address" required minLength={5} maxLength={500} /></label>
 <PaymentRules />
 <label className="payment-check"><input type="checkbox" required />I agree to GCash/bank payment only, no COD, and the stated return policy.</label>
 <p>This reserves the item. Pay the exact total, upload your receipt in My orders, and wait for manual confirmation. Cancel an unpaid order if you will not proceed.</p>
 <button type="submit" disabled={!stock || busy}>{busy ? "Placing order…" : "Place order & view payment details"}</button>
 </fieldset></form></>}
 </>;
}
export default function Page() { return <Suspense fallback={<p>Loading checkout…</p>}><Checkout /></Suspense>; }
