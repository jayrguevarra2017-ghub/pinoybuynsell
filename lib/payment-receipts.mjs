import { photoFormat, photoTypes, maxPhotoSize } from "./listing-photo-format.mjs";
import { withDeadline } from "./verification-actions.js";
export const paymentReceiptBucket = "payment-receipts";
export const paymentUUID = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization", "X-Content-Type-Options": "nosniff" };
const json = (body, status = 200) => Response.json(body, { status, headers });
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

async function limitedForm(request, signal) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data") || !request.body) throw Error("Choose a receipt image.");
  const reader = request.body.getReader(), parts = []; let length = 0;
  const cancel = () => { reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      length += chunk.value.length;
      if (length > maxPhotoSize + 16384 || signal.aborted) throw Error("Choose a receipt up to 5 MB.");
      parts.push(chunk.value);
    }
    if (signal.aborted) throw Error("Cancelled");
    return await new Response(new Blob(parts), { headers: { "Content-Type": request.headers.get("content-type") } }).formData();
  } finally { signal.removeEventListener("abort", cancel); cancel(); }
}

export async function handlePaymentReceipt(request, { env, createClient, timeoutMs = 20000 } = {}) {
  const controller = new AbortController(), cancel = () => controller.abort();
  request.signal.addEventListener("abort", cancel, { once: true });
  if (request.signal.aborted) cancel();
  try {
    return await withDeadline((async () => {
      const authorization = request.headers.get("authorization") || "";
      if (!/^Bearer \S+$/i.test(authorization)) return json({ message: "Sign in to access payment receipts." }, 401);
      if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY)
        return json({ message: "Receipt storage is unavailable. Contact support before paying." }, 503);
      const globalFetch = (url, init) => fetch(url, { ...init, signal: controller.signal });
      const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { ...options, global: { fetch: globalFetch, headers: { Authorization: authorization } } });
      const auth = await client.auth.getUser(authorization.slice(7));
      if (auth.error || !paymentUUID(auth.data?.user?.id)) return json({ message: "Sign in again." }, 401);
      if(controller.signal.aborted) throw Error("Cancelled");
      const userId = auth.data.user.id;
      const form = request.method === "POST" ? await limitedForm(request, controller.signal) : null;
      const query = new URL(request.url).searchParams;
      const orderId = form ? form.get("orderId") : query.get("orderId"), receiptId = form ? form.get("receiptId") : query.get("receiptId");
      if (!paymentUUID(orderId) || !paymentUUID(receiptId)) return json({ message: "Invalid receipt request." }, 400);
      // RLS verifies buyer/seller/trusted-admin access before the service role is used.
      const order = await client.from("marketplace_orders").select("id,buyer_id,status").eq("id", orderId).maybeSingle().abortSignal(controller.signal);
      if (order.error) return json({ message: "Payment setup is unavailable. Contact support." }, 503);
      if (!order.data || order.data.id !== orderId) return json({ message: "Order not found." }, 404);
      const server = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { ...options, global: { fetch: globalFetch } });
      if (request.method === "GET") {
        const receipt = await client.from("marketplace_payment_receipts").select("id,order_id,buyer_id,path,content_type").eq("id", receiptId).eq("order_id", orderId).maybeSingle().abortSignal(controller.signal);
        const r = receipt.data;
        if (receipt.error || !r || r.order_id !== orderId || r.buyer_id !== order.data.buyer_id || !photoTypes[r.content_type]
          || r.path !== `${r.buyer_id}/${orderId}/${receiptId}.${photoTypes[r.content_type]}`) return json({ message: "Receipt not found." }, 404);
        const bucket = await server.storage.getBucket(paymentReceiptBucket);
        if (bucket.error || bucket.data?.public !== false) return json({ message: "Private receipt storage unavailable." }, 503);
        const result = await server.storage.from(paymentReceiptBucket).download(r.path);
        if (result.error || !result.data || controller.signal.aborted) throw Error("Receipt unavailable");
        return new Response(result.data, { headers: { ...headers, "Content-Type": r.content_type, "Content-Disposition": "inline" } });
      }
      if (order.data.buyer_id !== userId) return json({ message: "Only the buyer can upload this receipt." }, 403);
      if (order.data.status !== "awaiting_payment") return json({ message: "This order is not accepting receipts. Refresh My orders." }, 409);
      const file = form.get("receipt");
      if (!file || typeof file.arrayBuffer !== "function" || file.size < 1 || file.size > maxPhotoSize) return json({ message: "Choose a receipt image up to 5 MB." }, 400);
      const bytes = new Uint8Array(await file.arrayBuffer()), type = photoFormat(bytes.slice(0, 64));
      if (!photoTypes[type]) return json({ message: "Choose a JPEG, PNG or WebP receipt image." }, 400);
      const path = `${userId}/${orderId}/${receiptId}.${photoTypes[type]}`;
      const existing = await server.from("marketplace_payment_receipts").select("id,order_id,buyer_id,path").eq("id", receiptId).maybeSingle().abortSignal(controller.signal);
      if (existing.error) throw Error("Read unavailable");
      if (existing.data) {
        if (existing.data.order_id !== orderId || existing.data.buyer_id !== userId || existing.data.path !== path) return json({ message: "Receipt request already used." }, 409);
        return json({ id: receiptId, orderId });
      }
      let bucket = await server.storage.getBucket(paymentReceiptBucket);
      if (bucket.error) {
        if (String(bucket.error.statusCode) !== "404" && bucket.error.message !== "Bucket not found") throw Error("Storage unavailable");
        await server.storage.createBucket(paymentReceiptBucket, { public: false, fileSizeLimit: maxPhotoSize, allowedMimeTypes: Object.keys(photoTypes) });
        bucket = await server.storage.getBucket(paymentReceiptBucket);
      }
      if (bucket.error || bucket.data?.public !== false) throw Error("Private storage required");
      const upload = await server.storage.from(paymentReceiptBucket).upload(path, bytes, { contentType: type, upsert: false });
      if (upload.error && String(upload.error.statusCode) !== "409" && upload.error.message !== "The resource already exists") throw Error("Upload unconfirmed");
      if (upload.error) {
        // A previous timed-out upload is safe to resume only when its bytes match.
        const prior = await server.storage.from(paymentReceiptBucket).download(path);
        if (prior.error || !prior.data) throw Error("Upload unconfirmed");
        const old = new Uint8Array(await prior.data.arrayBuffer());
        if (old.length !== bytes.length || old.some((value, i) => value !== bytes[i])) return json({ message: "Choose a new receipt upload request." }, 409);
      }
      if (controller.signal.aborted) throw Error("Cancelled");
      const saved = await server.from("marketplace_payment_receipts").insert({ id: receiptId, order_id: orderId, buyer_id: userId, path, content_type: type, size_bytes: bytes.length }).select("id,order_id").single().abortSignal(controller.signal);
      if (saved.error || saved.data?.id !== receiptId || saved.data?.order_id !== orderId) throw Error("Upload unconfirmed");
      return json({ id: receiptId, orderId });
    })(), timeoutMs);
  } catch {
    return json({ message: request.method === "POST" ? "Receipt upload could not be confirmed. Check My orders before submitting again." : "Could not load the private receipt. Please try again." }, 503);
  } finally { controller.abort(); request.signal.removeEventListener("abort", cancel); }
}
