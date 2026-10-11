"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import PaymentAccountGate from "@/components/PaymentAccountGate";
import { supabase } from "@/lib/supabase";
import { paymentRPC, paymentMoney, orderStatuses, paymentMethodNames, receiptRequest } from "@/lib/marketplace-payments.mjs";
import { prepareListingPhoto } from "@/lib/listing-photo-format.mjs";
import { withDeadline } from "@/lib/verification-actions.js";
export default function MarketplaceOrders({ admin = false }) {
 const app = useApp();
 return <PaymentAccountGate admin={admin}>{app?.user && (!admin || app.isAdmin) && <Orders key={`${app.user.id}:${admin}`} userId={app.user.id} admin={admin} />}</PaymentAccountGate>;
}
function Orders({ userId, admin }) {
 const app = useApp(), [tab, setTab] = useState(admin ? "review" : "purchases"), [page, setPage] = useState(0), [rows, setRows] = useState(null), [won, setWon] = useState([]);
 const [error, setError] = useState(""), [revision, setRevision] = useState(0), [hasMore, setHasMore] = useState(false);
 const [selected, setSelected] = useState("");
 useEffect(() => { setSelected(new URLSearchParams(window.location.search).get("order") || ""); }, []);
 useEffect(() => {
  const c = new AbortController(); setRows(null); setError("");
  (async () => {
   let q = supabase.from("marketplace_orders").select("*");
   if (tab === "purchases") q = q.eq("buyer_id", userId);
   if (tab === "sales") q = q.eq("seller_id", userId);
   if (tab === "review") q = q.eq("status", "payment_submitted");
   const result = await withDeadline(q.order("created_at", { ascending: false }).order("id", { ascending: false }).range(page*25, page*25+25).abortSignal(c.signal));
   if (result.error || !Array.isArray(result.data)) throw Error("Could not load orders. The payment database update may need to be installed.");
   if (!c.signal.aborted) { setHasMore(result.data.length > 25); setRows(result.data.slice(0,25)); }
  })().catch(e => { if (!c.signal.aborted) setError(e.message); });
  if (!admin && tab === "purchases") paymentRPC(supabase,"marketplace_won_auctions",{},c.signal).then(data => { if (!c.signal.aborted && Array.isArray(data)) setWon(data); }).catch(() => { if (!c.signal.aborted) setWon([]); });
  return () => c.abort();
 }, [userId, tab, page, revision, admin]);
 function refresh() { setRevision(v => v+1); app.refreshAdminAttention?.(); }
 return <><h1>{admin ? "Payment reviews" : "Orders & sales"}</h1>
 <div className="payment-toolbar">{(admin ? [["review","Awaiting review"],["all","All orders"]] : [["purchases","My purchases"],["sales","My sales"]]).map(([key,label]) => <button key={key} aria-pressed={tab===key} onClick={() => { setTab(key); setPage(0); }}>{label}</button>)}<button onClick={refresh}>Refresh</button></div>
 {app.isAdmin && <p><Link href="/account/payment-settings">Set my GCash / bank details</Link>{!admin && <> · <Link href="/admin/payments">Review all payments</Link></>}</p>}
 {!admin && tab === "purchases" && won.length>0 && <section className="payment-wins"><h2>Won auctions ready for payment</h2>{won.map(w => <p key={w.id}><Link href={`/account/checkout?listing=${w.id}`}>{w.title}</Link> · Winning bid {paymentMoney(w.amount)} + shipping</p>)}</section>}
 {error && <p role="alert">{error}</p>}{!rows && !error && <p>Loading orders…</p>}{rows?.length===0 && <p>No orders in this view.</p>}
 {rows?.map(order => <OrderCard key={`${order.id}:${order.updated_at}`} order={order} userId={userId} canReview={app.isAdmin} selected={selected===order.id} onChanged={refresh} />)}
 {rows && <div className="payment-toolbar"><button disabled={!page} onClick={() => setPage(v => v-1)}>Previous</button><span>Page {page+1}</span><button disabled={!hasMore} onClick={() => setPage(v => v+1)}>Next</button></div>}
 <p>Receipts are reviewed manually. “Receipt awaiting review” does not mean payment has been received. For delivery, disputes or refunds, contact the seller or support team.</p></>;
}
function OrderCard({ order, userId, canReview, selected, onChanged }) {
 const buyer = order.buyer_id===userId, [busy,setBusy] = useState(false), [message,setMessage] = useState(""), [receiptURL,setReceiptURL] = useState("");
 const [file,setFile] = useState(null), [method,setMethod] = useState(Object.keys(order.payment_details)[0] || ""), [reference,setReference] = useState(""), [note,setNote] = useState(""), [verified,setVerified] = useState(false);
 const attempt = useRef(null), lock = useRef(false), life = useRef(null), previewURL = useRef("");
 useEffect(() => { const c=new AbortController(); life.current=c; return () => { c.abort(); if(previewURL.current) URL.revokeObjectURL(previewURL.current); }; }, []);
 async function action(task) {
  if (lock.current) return; lock.current=true; setBusy(true); setMessage("");
  try { await task(life.current.signal); }
  catch(e) { if (!life.current.signal.aborted) setMessage(`${e.message} Refresh orders to check the latest status before trying again.`); }
  finally { if (!life.current.signal.aborted) { lock.current=false; setBusy(false); } }
 }
 function confirmed(result, status) {
  if (result?.id!==order.id || result.status!==status) throw Error("The order update could not be confirmed.");
  if (!life.current.signal.aborted) onChanged();
 }
 async function submitReceipt(e) { e.preventDefault(); await action(async signal => {
  if (!file) throw Error("Choose a payment receipt photo.");
  const photo=await prepareListingPhoto(file); if(signal.aborted) return;
  attempt.current ||= crypto.randomUUID(); const form=new FormData(); form.set("orderId",order.id); form.set("receiptId",attempt.current); form.set("receipt",photo);
  await withDeadline(receiptRequest(supabase,userId,{form,orderId:order.id,receiptId:attempt.current,signal}),20000);
  if(signal.aborted) return;
  const result=await paymentRPC(supabase,"submit_marketplace_payment",{p_order_id:order.id,p_receipt_id:attempt.current,p_method:method,p_reference:reference},signal);
  confirmed(result,"payment_submitted");
 }); }
 async function review(decision) { await action(async signal => {
  if (decision==="paid" && !verified) throw Error("Verify funds arrived before confirming payment.");
  const result=await paymentRPC(supabase,"review_marketplace_payment",{p_order_id:order.id,p_receipt_id:order.last_receipt_id,p_decision:decision,p_note:note},signal);
  confirmed(result,decision==="paid"?"paid":"awaiting_payment");
 }); }
 return <details className="payment-order" open={selected || undefined}><summary><strong>{order.title}</strong><span>{paymentMoney(order.total)} · {orderStatuses[order.status]}</span></summary>
 <p>Order {order.id} · {new Date(order.created_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</p>
 <p><Link href={`/product/${order.product_id}`}>View listing</Link> · {order.quantity} × {paymentMoney(order.unit_price)}{order.variation && ` · ${order.variation}`}</p>
 <p>{order.shipping_carrier} shipping: {paymentMoney(order.shipping_fee)} · <strong>Total: {paymentMoney(order.total)}</strong></p>
 <p>Deliver to: {order.recipient_name} · {order.phone}<br />{order.address}</p>
 {order.review_note && <p className="payment-review-note">Reviewer note: {order.review_note}</p>}
 {order.paid_at && <p>Payment confirmed: {new Date(order.paid_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</p>}
 {order.status!=="cancelled" && <section><h3>Payment instructions for this order</h3>{Object.entries(order.payment_details).map(([m,d]) => <p key={m}><strong>{paymentMethodNames[m]}</strong>{d.bank && ` · ${d.bank}`}<br />Account name: {d.name}<br />Account / mobile number: {d.account}</p>)}
 <p>Pay the exact total. Check the recipient before sending; GCash/bank payments happen outside this website. No COD.</p></section>}
 {buyer && order.status==="awaiting_payment" && <form onSubmit={submitReceipt}><fieldset disabled={busy}><legend>Submit payment receipt</legend>
 <label>Payment method<select value={method} onChange={e=>setMethod(e.target.value)} required>{Object.keys(order.payment_details).map(m=><option key={m} value={m}>{paymentMethodNames[m]}</option>)}</select></label>
 <label>Transaction reference<input value={reference} onChange={e=>setReference(e.target.value)} required maxLength={120} /></label>
 <label>Receipt photo (up to 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" required onChange={e=>{setFile(e.target.files?.[0]||null);attempt.current=null;}} /></label>
 <p>Receipts are private to this order’s buyer, seller and administrators. Hide unrelated balances or transactions before uploading. Never upload PINs or passwords.</p><button>{busy?"Submitting…":"Upload receipt & submit for review"}</button>
 </fieldset></form>}
 {order.last_receipt_id && <><p>Submitted via {paymentMethodNames[order.payment_method]} · Reference: {order.payment_reference}</p>
 <button disabled={busy} onClick={()=>action(async signal=>{const blob=await withDeadline(receiptRequest(supabase,userId,{orderId:order.id,receiptId:order.last_receipt_id,signal}),15000);
 if(!signal.aborted){if(previewURL.current)URL.revokeObjectURL(previewURL.current);previewURL.current=URL.createObjectURL(blob);setReceiptURL(previewURL.current);}})}>View private receipt</button>
 {receiptURL && <img className="payment-receipt" src={receiptURL} alt="Payment receipt for this order" />}</>}
 {canReview && order.status==="payment_submitted" && <fieldset disabled={busy}><legend>Review payment</legend><p>Check the receipt and your actual account transactions. An uploaded image alone is not proof that funds arrived.</p>
 <label>Review note<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} /></label>
 <label className="payment-check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)} />I verified that the full payment arrived in the receiving account.</label>
 <div className="payment-toolbar"><button disabled={!verified} onClick={()=>review("paid")}>Confirm payment received</button><button disabled={!note.trim()} onClick={()=>review("rejected")}>Reject receipt with reason</button></div></fieldset>}
 {order.auction_id && order.status==="awaiting_payment" && <p>Cancelling this auction order requires seller or support help to arrange another purchase.</p>}
 {order.status==="awaiting_payment" && (buyer || canReview || order.seller_id===userId) && <button disabled={busy} onClick={()=>action(async signal=>confirmed(await paymentRPC(supabase,"cancel_marketplace_order",{p_order_id:order.id},signal),"cancelled"))}>Cancel unpaid order</button>}
 {message && <p role="alert">{message}</p>}
 </details>;
}
