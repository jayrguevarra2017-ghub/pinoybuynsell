import test from "node:test";
import assert from "node:assert/strict";
import { createListingViewsStore, parseListingViews, listingViewsRPC } from "../lib/listing-views.mjs";

const row = (id, count = "0") => ({ listing_id: id, view_count: count });
const wait = () => new Promise(resolve => setTimeout(resolve, 15));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test("view counts preserve bigint precision and reject unrequested or invalid totals", () => {
  assert.equal(parseListingViews([row("4", "9223372036854775807")], ["4"]).get("4").count, "9223372036854775807");
  for (const rows of [null, {}, [row("5")], [row("4"), row("4")], [row("4", -1)], [row("4", "-1")], [row("4", "01")], [row("4", "9223372036854775808")]])
    assert.throws(() => parseListingViews(rows, ["4"]), /unavailable/);
});

test("public counter requests never attach a customer's session and bound network/body stalls", async () => {
  const options = { url: "https://example.supabase.co/", publicKey: "public-key" };
  const result = await listingViewsRPC("marketplace_listing_view_counts", { p_listing_ids: ["4"] }, { ...options, fetchImpl: async (url, request) => {
    assert.equal(url, "https://example.supabase.co/rest/v1/rpc/marketplace_listing_view_counts");
    assert.equal(request.headers.Authorization, "Bearer public-key"); assert.equal(request.credentials, "omit");
    assert.equal(request.cache, "no-store"); assert.deepEqual(JSON.parse(request.body), { p_listing_ids: ["4"] });
    return Response.json([row("4", "2")]);
  } });
  assert.deepEqual(result, [row("4", "2")]);
  for (const fetchImpl of [async () => Response.json({ message: "secret-provider-details" }, { status: 404 }),
    () => new Promise(() => {}), async () => ({ ok: true, json: () => new Promise(() => {}) })])
    await assert.rejects(() => listingViewsRPC("marketplace_listing_view_counts", {}, { ...options, timeoutMs: 10, fetchImpl }), /^Error: View counts unavailable\.$/);
});

test("card subscriptions batch counts without recording views; duplicate cards stay in sync", async () => {
  const reads = []; let writes = 0;
  const store = createListingViewsStore({ batchDelayMs: 0, read: async ids => { reads.push(ids); return ids.map(id => row(id, "12")); }, record: async id => { writes++; return row(id, "13"); } });
  store.subscribe("4", () => {}); store.subscribe("4", () => {}); store.subscribe("5", () => {});
  assert.equal(store.get("4").count, null); await wait(); assert.equal(reads.length, 0);
  store.activate(true); await wait(); assert.deepEqual(reads, [["4", "5"]]); assert.equal(writes, 0);
  await store.record("4"); assert.equal(store.get("4").count, "13"); assert.equal(writes, 1);
  await store.record("4"); assert.equal(writes, 1); store.dispose();
});

test("listing counts are split into batches of at most 100", async () => {
  const reads = [], store = createListingViewsStore({ batchDelayMs: 0, read: async ids => { reads.push(ids.length); return ids.map(id => row(id)); } });
  for (let id = 1; id <= 205; id++) store.subscribe(String(id), () => {});
  store.activate(true); await wait(); assert.deepEqual(reads, [100, 100, 5]); store.dispose();
});

test("late card reads cannot overwrite a newly recorded item view", async () => {
  const read = deferred(), store = createListingViewsStore({ batchDelayMs: 0, read: () => read.promise, record: async id => row(id, "9") });
  store.subscribe("4", () => {}); store.activate(true); await wait();
  await store.record("4"); read.resolve([row("4", "8")]); await wait();
  assert.equal(store.get("4").count, "9"); store.dispose();
});

test("overlapping detail records count once and roll over at Philippine midnight", async () => {
  let time = Date.parse("2026-10-11T15:59:59Z"), writes = 0;
  const response = deferred();
  const store = createListingViewsStore({ now: () => time, read: async ids => ids.map(id => row(id)), record: async id => { writes++; if (writes === 1) await response.promise; return row(id, String(writes)); } });
  store.activate(true); const first = store.record("4"); await store.record("4"); assert.equal(writes, 1);
  response.resolve(); await first; await store.record("4"); assert.equal(writes, 1);
  time += 2000; await store.record("4"); assert.equal(writes, 2); store.dispose();
});

test("unavailable counters never invent zero and uncertain writes do not retry automatically", async () => {
  let writes = 0, reads = 0;
  const store = createListingViewsStore({ batchDelayMs: 0, read: async () => { reads++; throw Error("private-provider-details"); }, record: async () => { writes++; throw Error("private-provider-details"); } });
  store.subscribe("4", () => {}); store.activate(true); await wait();
  assert.deepEqual(store.get("4"), { count: null, error: true });
  await store.record("4"); await wait(); assert.equal(writes, 1); assert.equal(reads, 2); assert.equal(store.get("4").count, null);
  store.dispose(); await store.record("4"); assert.equal(writes, 1);
});

test("a disposed store ignores late results and offline cards do not send requests", async () => {
  const response = deferred(); let reads = 0;
  const store = createListingViewsStore({ batchDelayMs: 0, read: async () => { reads++; return response.promise; } });
  store.subscribe("4", () => {}); store.activate(false); await wait(); assert.equal(reads, 0);
  store.activate(true); await wait(); store.dispose(); response.resolve([row("4", "3")]); await wait();
  assert.equal(store.get("4").count, null);
});
