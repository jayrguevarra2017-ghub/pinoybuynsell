import { withDeadline } from "./verification-actions.js";
export const orderStatuses = { awaiting_payment: "Awaiting payment", payment_submitted: "Receipt awaiting review", paid: "Payment confirmed", cancelled: "Cancelled" };
export const paymentMethodNames = { gcash: "GCash", bank_deposit: "Bank deposit" };
export const paymentMoney = value => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value));
export async function paymentRPC(client, name, args = {}, signal) {
  const c = new AbortController(), cancel = () => c.abort();
  signal?.addEventListener("abort",cancel,{once:true}); if(signal?.aborted) cancel();
  const timer = setTimeout(cancel,15000);
  let result;
  try { if(c.signal.aborted) throw Error("Request cancelled."); result = await withDeadline(client.rpc(name, args).abortSignal(c.signal),15000); }
  finally { clearTimeout(timer); signal?.removeEventListener("abort",cancel); }

  if (result.error) {
    if (["PGRST202", "PGRST205", "42P01", "42883"].includes(result.error.code)) throw Error("Payments are not enabled yet. The administrator needs to install the payment database update.");
    throw Error(result.error.message || "Payment action failed.");
  }
  return result.data;
}
export async function receiptRequest(client, userId, { form, orderId, receiptId, signal } = {}) {
  const c = new AbortController(), cancel = () => c.abort();
  signal?.addEventListener("abort",cancel,{once:true}); if(signal?.aborted) cancel();
  const timer = setTimeout(cancel,20000);
  try {
  const session = await withDeadline(client.auth.getSession());
  if(c.signal.aborted) throw Error("Request cancelled.");
  if (session.error || session.data?.session?.user?.id !== userId) throw Error("Sign in again before accessing receipts.");
  const response = await fetch(`/api/marketplace/payments/receipts${form ? "" : `?orderId=${encodeURIComponent(orderId)}&receiptId=${encodeURIComponent(receiptId)}`}`, {
    method: form ? "POST" : "GET", body: form, signal: c.signal, cache: "no-store", headers: { Authorization: `Bearer ${session.data.session.access_token}` },
  });
  if (!response.ok) { let body; try { body = await response.json(); } catch {} throw Error(body?.message || "Receipt access failed."); }
  if (!form) return await response.blob();
  const result = await response.json();
  if (result.id !== receiptId || result.orderId !== orderId) throw Error("Receipt upload could not be confirmed.");
  return result;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort",cancel); }
}
