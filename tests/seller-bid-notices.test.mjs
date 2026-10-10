import test from "node:test";
import assert from "node:assert/strict";
import { handleSellerBidNotices } from "../lib/seller-bid-notices.mjs";
import { bidReadPreference } from "../lib/bid-notice-content.mjs";
const owner = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
const date = "2026-10-10T00:00:00Z";
function fixture(options = {}) {
  const calls = [], writes = [];
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key", SUPABASE_SERVICE_ROLE_KEY: "service-secret", ...options.env };
  const products = options.products || [{ id: 1, title: "Own Jordan card", seller_id: owner }, { id: 2, title: "Other seller's private listing", seller_id: other }];
  const auctions = options.auctions || [{ id: 10, product_id: 1 }, { id: 20, product_id: 2 }];
  const bids = options.bids || [{ id: 5, auction_id: "10", amount: 150, created_at: date, bidder_id: other }, { id: 6, auction_id: "20", amount: 500, created_at: date }];
  let metadata = { full_name: "Private name", is_admin: true, [bidReadPreference]: options.readIds || [] };
  const user = { auth: { getUser: async token => {
    calls.push(["auth", token]); return options.hangAuth ? new Promise(() => {}) : options.authError ? { error: {} } : { data: { user: { id: owner, user_metadata: metadata } } };
  } } };
  const server = { from(table) {
    const filters = [], q = { field: "", ascending: true, start: 0, end: Infinity,
      select(fields) { calls.push(["select", table, fields]); return q; },
      eq(field, value) { filters.push(row => row[field] === value); calls.push(["eq", table, field, value]); return q; },
      is(field) { filters.push(row => row[field] == null); return q; },
      in(field, values) { filters.push(row => values.includes(String(row[field]))); calls.push(["in", table, field, values]); return q; },
      order(field, { ascending }) { q.field = field; q.ascending = ascending; return q; },
      range(start, end) { q.start = start; q.end = end; calls.push(["range", table, start]); return q; },
      limit(number) { q.end = number - 1; return q; }, abortSignal() { return q; },
      then(resolve, reject) {
        if (options.hangTable === table) return new Promise(() => {}).then(resolve, reject);
        if (options.failTable === table) return Promise.resolve({ error: { message: "service-secret" } }).then(resolve, reject);
        let rows = ({ products, auctions, marketplace_bids: bids })[table].filter(row => filters.every(filter => filter(row)));
        if (options.injectTable === table) rows = [table === "products" ? products[1] : table === "auctions" ? auctions[1] : bids[1]];
        rows = [...rows].sort((a, b) => (a[q.field] - b[q.field]) * (q.ascending ? 1 : -1)).slice(q.start, q.end + 1);
        return Promise.resolve({ data: rows }).then(resolve, reject);
      },
    }; return q;
  } };
  const createClient = (_url, key, settings) => { calls.push(["client", key, settings]); return key === env.SUPABASE_SERVICE_ROLE_KEY ? server : user; };
  const fetchImpl = async (url, request) => {
    writes.push([url, request]);
    if (options.hangSave) return new Promise(() => {});
    metadata = { ...metadata, ...JSON.parse(request.body).data };
    return Response.json(options.saved || { id: owner, user_metadata: metadata }, { status: options.saveStatus || 200 });
  };
  const request = options.request || new Request(`https://pinoybuynsell.com/api/marketplace/bid-notifications${options.query || ""}`, {
    method: options.ids ? "POST" : "GET", headers: { ...(options.noAuth ? {} : { Authorization: "Bearer user-token" }), ...(options.ids ? { "Content-Type": "application/json" } : {}) },
    ...(options.ids ? { body: JSON.stringify({ ids: options.ids }) } : {}),
  });
  return { calls, writes, run: () => handleSellerBidNotices(request, { env, createClient, fetchImpl, timeoutMs: options.timeoutMs ?? 200 }) };
}
test("anonymous and invalid sessions never access the service role or bid history", async () => {
  for (const options of [{ noAuth: true }, { authError: true }]) {
    const f = fixture(options); assert.equal((await f.run()).status, 401); assert(!f.calls.some(call => call[1] === "service-secret")); assert.equal(f.writes.length, 0);
  }
});
test("bid notifications are scoped to the verified owner, ignore supplied seller IDs and omit bidder identities", async () => {
  const f = fixture({ query: `?sellerId=${other}` }); const response = await f.run(); const result = await response.json();
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(result.items.length, 1); assert.deepEqual(result.items[0], { id: "5", listingId: "1", title: "Own Jordan card", amount: 150, createdAt: date, read: false });
  assert(!JSON.stringify(result).includes(other)); assert(!JSON.stringify(result).includes("Private name"));
  assert(f.calls.some(call => call[0] === "eq" && call[1] === "products" && call[3] === owner));
  assert.deepEqual(f.calls.find(call => call[0] === "select" && call[1] === "marketplace_bids")[2], "id,auction_id,amount,created_at");
});
test("unexpected foreign rows and database failures cannot leak another seller's bids or become an all-clear", async () => {
  for (const options of [{ injectTable: "products" }, { injectTable: "auctions" }, { injectTable: "marketplace_bids" }, { failTable: "marketplace_bids" }, { env: { SUPABASE_SERVICE_ROLE_KEY: "" } }]) {
    const f = fixture(options); const response = await f.run(); assert.equal(response.status, 503);
    const text = await response.text(); assert(!text.includes(other)); assert(!text.includes("service-secret")); assert.equal(f.writes.length, 0);
  }
});
test("ordinary accounts with no listings receive an empty feed without querying bids", async () => {
  const f = fixture({ products: [] }); const result = await (await f.run()).json();
  assert.deepEqual(result.items, []); assert.equal(result.hasListings, false); assert(!f.calls.some(call => call[1] === "marketplace_bids"));
});
test("owner listings beyond the first database page contribute bids", async () => {
  const products = Array.from({ length: 501 }, (_, i) => ({ id: i + 1, title: `Own item ${i + 1}`, seller_id: owner }));
  const f = fixture({ products, auctions: [{ id: 501, product_id: 501 }], bids: [{ id: 9, auction_id: "501", amount: 200, created_at: date }] });
  const result = await (await f.run()).json(); assert.equal(result.items[0].listingId, "501");
  assert(f.calls.some(call => call[0] === "range" && call[1] === "products" && call[2] === 500));
});
test("the feed returns the latest fifty confirmed bids in ID order and discloses the history limit", async () => {
  const bids = Array.from({ length: 55 }, (_, i) => ({ id: i + 1, auction_id: "10", amount: 100 + i, created_at: date }));
  const f = fixture({ bids, readIds: ["55", "54"] }); const result = await (await f.run()).json();
  assert.equal(result.items.length, 50); assert.equal(result.hasMore, true); assert.equal(result.items[0].id, "55"); assert.equal(result.items.at(-1).id, "6");
  assert.equal(result.items[0].read, true); assert.equal(result.items[2].read, false);
});
test("marking viewed bids saves only an own-account preference with the buyer token, preserving other preferences", async () => {
  const f = fixture({ ids: ["5"], readIds: ["3"] }); const response = await f.run(); assert.equal(response.status, 200);
  assert.equal((await response.json()).items[0].read, true); assert.equal(f.writes.length, 1);
  const [url, request] = f.writes[0]; assert.equal(url, "https://example.supabase.co/auth/v1/user");
  assert.equal(request.headers.Authorization, "Bearer user-token"); assert.equal(request.headers.apikey, "public-key");
  assert.deepEqual(JSON.parse(request.body), { data: { [bidReadPreference]: ["5", "3"] } });
});
test("foreign, stale or invalid selected bid IDs cannot start a read-status write", async () => {
  for (const [ids, status] of [[["6"], 409], [["999"], 409], [["0"], 400], [Array(51).fill("5"), 400], [[], 400]]) {
    const f = fixture({ ids }); assert.equal((await f.run()).status, status); assert.equal(f.writes.length, 0);
  }
});
test("unconfirmed read saves never claim success and cannot retry automatically", async () => {
  for (const options of [{ saveStatus: 503 }, { saved: { id: other, user_metadata: { [bidReadPreference]: ["5"] } } }, { saved: { id: owner, user_metadata: {} } }, { hangSave: true }]) {
    const f = fixture({ ...options, ids: ["5"], timeoutMs: 15 }); const response = await f.run();
    assert.equal(response.status, 503); assert.match((await response.json()).message, /Could not confirm/); assert.equal(f.writes.length, 1);
  }
});
test("authentication and data reads have deadlines and never mutate preferences on failure", async () => {
  for (const options of [{ hangAuth: true }, { hangTable: "marketplace_bids" }]) {
    const f = fixture({ ...options, timeoutMs: 10 }); const response = await f.run(); assert.equal(response.status, 503); assert.equal(f.writes.length, 0);
  }
});
test("a stalled mark-read body is cancelled at the deadline without updating account preferences", async () => {
  let cancelled = false;
  const request = new Request("https://pinoybuynsell.com/api/marketplace/bid-notifications", { method: "POST", duplex: "half",
    headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" }, body: new ReadableStream({ cancel() { cancelled = true; } }) });
  const f = fixture({ request, timeoutMs: 10 }); assert.equal((await f.run()).status, 503); assert.equal(f.writes.length, 0); assert(cancelled);
});
