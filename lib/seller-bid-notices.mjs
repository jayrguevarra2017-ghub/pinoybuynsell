import { validSellerId } from "./seller-community.mjs";
import { recentBidLimit, bidReadPreference, validBidId, bidReadIds, mergeBidReadIds } from "./bid-notice-content.mjs";
import { withDeadline } from "./verification-actions.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const id = value => typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;

async function pages(query, signal) {
  const rows = [], seen = new Set();
  for (let offset = 0; offset < 10000; offset += 500) {
    const result = await query().order("id", { ascending: true }).range(offset, offset + 499).abortSignal(signal);
    if (result.error || !Array.isArray(result.data)) throw Error("Read unavailable");
    for (const row of result.data) {
      const key = id(row.id);
      if (!validBidId(key) || seen.has(key)) throw Error("Read unavailable");
      seen.add(key); rows.push(row);
    }
    if (result.data.length < 500) return rows;
  }
  throw Error("Read requires database pagination");
}

async function recentBids(server, userId, signal) {
  const products = await pages(() => server.from("products").select("id,title,seller_id")
    .eq("seller_id", userId).is("deleted_at", null), signal);
  if (products.some(product => product.seller_id !== userId || typeof product.title !== "string")) throw Error("Read unavailable");
  const byProduct = new Map(products.map(product => [id(product.id), product]));
  const auctions = [];
  for (let index = 0; index < products.length; index += 100) {
    const selected = products.slice(index, index + 100).map(product => id(product.id));
    const rows = await pages(() => server.from("auctions").select("id,product_id").in("product_id", selected), signal);
    if (rows.some(auction => !selected.includes(id(auction.product_id)))) throw Error("Read unavailable");
    auctions.push(...rows);
  }
  const byAuction = new Map(auctions.map(auction => [id(auction.id), byProduct.get(id(auction.product_id))]));
  const bids = [], seen = new Set();
  for (let index = 0; index < auctions.length; index += 100) {
    const selected = auctions.slice(index, index + 100).map(auction => id(auction.id));
    const result = await server.from("marketplace_bids").select("id,auction_id,amount,created_at")
      .in("auction_id", selected).order("id", { ascending: false }).limit(recentBidLimit + 1).abortSignal(signal);
    if (result.error || !Array.isArray(result.data)) throw Error("Read unavailable");
    for (const bid of result.data) {
      const key = id(bid.id), auctionId = id(bid.auction_id);
      if (!validBidId(key) || seen.has(key) || !selected.includes(auctionId)
        || !Number.isFinite(Number(bid.amount)) || Number(bid.amount) <= 0 || !Number.isFinite(Date.parse(bid.created_at))) throw Error("Read unavailable");
      seen.add(key); const product = byAuction.get(auctionId);
      bids.push({ id: key, listingId: id(product.id), title: product.title.slice(0, 200), amount: Number(bid.amount), createdAt: bid.created_at });
    }
  }
  bids.sort((a, b) => BigInt(a.id) > BigInt(b.id) ? -1 : 1);
  return { items: bids.slice(0, recentBidLimit), hasMore: bids.length > recentBidLimit, hasListings: products.length > 0 };
}

// The service role only reads bid rows after a verified ownership filter. Read
// receipts are private user preferences, never a source of administrator access.
export async function handleSellerBidNotices(request, { env, createClient, fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const controller = new AbortController(), cancel = () => controller.abort();
  request.signal.addEventListener("abort", cancel, { once: true });
  if (request.signal.aborted) cancel();
  try {
    return await withDeadline((async () => {
      const authorization = request.headers.get("authorization") || "";
      if (!/^Bearer \S+$/i.test(authorization)) return json({ message: "Sign in to view your bid notifications." }, 401);
      const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) return json({ message: "Bid notifications are temporarily unavailable." }, 503);
      const client = createClient(url, key, { ...clientOptions, global: { headers: { Authorization: authorization } } });
      const auth = await client.auth.getUser(authorization.slice(7));
      if (controller.signal.aborted) throw Error("Cancelled");
      if (auth.error || !validSellerId(auth.data?.user?.id)) return json({ message: "Sign in again to check bid notifications." }, 401);
      if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ message: "Bid notifications are temporarily unavailable." }, 503);
      const user = auth.data.user;
      const server = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, clientOptions);
      const recent = await recentBids(server, user.id, controller.signal);
      let readIds = bidReadIds(user.user_metadata?.[bidReadPreference]);
      if (request.method === "POST") {
        if (!request.headers.get("content-type")?.startsWith("application/json") || Number(request.headers.get("content-length")) > 12000)
          return json({ message: "Refresh notifications before marking them as read." }, 400);
        // Limit the streamed body too; Content-Length is not trusted.
        const reader = request.body?.getReader(); let text = "", bytes = 0;
        if (!reader) return json({ message: "Refresh notifications before marking them as read." }, 400);
        const cancelBody = () => { reader.cancel().catch(() => {}); };
        controller.signal.addEventListener("abort", cancelBody, { once: true });
        try {
          const decoder = new TextDecoder();
          while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength;
            if (bytes > 12000) throw Error("Body too large"); text += decoder.decode(part.value, { stream: true }); }
          text += decoder.decode();
        } catch { return json({ message: "Refresh notifications before marking them as read." }, 400); }
        finally { controller.signal.removeEventListener("abort", cancelBody); cancelBody(); }
        let body; try { body = JSON.parse(text); } catch { return json({ message: "Invalid notification request." }, 400); }
        if (!Array.isArray(body?.ids) || !body.ids.length || body.ids.length > recentBidLimit || body.ids.some(value => !validBidId(value)))
          return json({ message: "Choose recent bid notifications to mark as read." }, 400);
        if (body.ids.some(value => !recent.items.some(item => item.id === value)))
          return json({ message: "The recent bids changed. Refresh notifications before marking them as read." }, 409);
        const selected = [...new Set(body.ids)]; readIds = mergeBidReadIds(readIds, selected);
        if (controller.signal.aborted) throw Error("Cancelled");
        const response = await fetchImpl(`${url}/auth/v1/user`, { method: "PUT", signal: controller.signal, redirect: "error", cache: "no-store",
          headers: { Authorization: authorization, apikey: key, "Content-Type": "application/json" },
          body: JSON.stringify({ data: { [bidReadPreference]: readIds } }) });
        if (!response.ok) throw Error("Read save unavailable");
        const saved = await response.json();
        const confirmed = bidReadIds(saved.user_metadata?.[bidReadPreference]);
        if (saved.id !== user.id || selected.some(value => !confirmed.includes(value))) throw Error("Read save unconfirmed");
        readIds = confirmed;
      }
      const read = new Set(readIds);
      return json({ ...recent, userId: user.id, items: recent.items.map(item => ({ ...item, read: read.has(item.id) })) });
    })(), timeoutMs);
  } catch {
    return json({ message: request.method === "POST"
      ? "Could not confirm the read status. Refresh notifications to check before trying again."
      : "Could not load bid notifications. Please try again." }, 503);
  } finally { controller.abort(); request.signal.removeEventListener("abort", cancel); }
}
