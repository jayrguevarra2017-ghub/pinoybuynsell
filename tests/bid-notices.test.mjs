import test from "node:test";
import assert from "node:assert/strict";
import { bidReadIds, mergeBidReadIds, validBidNotices } from "../lib/bid-notice-content.mjs";
import { createBidNoticeStore, requestBidNotices, unreadBidCount } from "../lib/bid-notices.mjs";
const item = { id: "5", listingId: "1", title: "Jordan card", amount: 150, createdAt: "2026-10-10T00:00:00Z", read: false };
const result = { userId: "owner", items: [item], hasMore: false, hasListings: true };
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
test("read preferences are bounded, deduplicated and preserve precision for bigint IDs", () => {
  assert.deepEqual(bidReadIds(["5", "5", 6, "0", "-1", "999999999999999999", "1000000000000000000"]), ["1000000000000000000", "999999999999999999", "5"]);
  assert.equal(mergeBidReadIds(Array.from({ length: 100 }, (_, i) => String(i + 1)), ["101"]).length, 100);
  assert.deepEqual(bidReadIds(null), []);
});
test("notification responses cannot use another account, malformed amounts or duplicated bid IDs", () => {
  assert(validBidNotices(result, "owner"));
  for (const bad of [{ ...result, userId: "other" }, { ...result, items: [item, item] }, { ...result, items: [{ ...item, amount: NaN }] }, { ...result, items: [{ ...item, listingId: "../admin" }] }]) assert(!validBidNotices(bad, "owner"));
});
test("initial bids are counted without a new-bid popup; later confirmed arrivals produce one notice", async () => {
  let data = result, reads = 0; const store = createBidNoticeStore({ read: async () => { reads++; return data; } });
  assert.equal(unreadBidCount(store.getSnapshot()), null); store.activate(true); await pause();
  assert.equal(unreadBidCount(store.getSnapshot()), 1); assert.equal(store.getSnapshot().notice, null);
  data = { ...result, items: [{ ...item, id: "6", amount: 200 }, item] }; await store.refresh();
  assert.equal(unreadBidCount(store.getSnapshot()), 2); assert.equal(store.getSnapshot().notice.id, "6");
  store.dismiss(); await store.refresh(); assert.equal(store.getSnapshot().notice, null); assert.equal(reads, 3); store.activate(false);
});
test("double mark-read clicks send one mutation and change counts only after confirmation", async () => {
  let release, writes = 0;
  const store = createBidNoticeStore({ read: async () => result, mark: async ids => { writes++; assert.deepEqual(ids, ["5"]); return new Promise(resolve => release = resolve); } });
  store.activate(true); await pause(); const first = store.markRead(["5"]); await store.markRead(["5"]);
  assert.equal(writes, 1); assert.equal(unreadBidCount(store.getSnapshot()), 1);
  release({ ...result, items: [{ ...item, read: true }] }); await first; assert.equal(unreadBidCount(store.getSnapshot()), 0); store.activate(false);
});
test("a toast is cleared when its bid is marked read or removed from the latest confirmed feed", async () => {
  let data = result; const store = createBidNoticeStore({ read: async () => data }); store.activate(true); await pause();
  data = { ...result, items: [{ ...item, id: "6" }, item] }; await store.refresh(); assert.equal(store.getSnapshot().notice.id, "6");
  data = { ...result, items: [{ ...item, id: "6", read: true }, item] }; await store.refresh(); assert.equal(store.getSnapshot().notice, null); store.activate(false);
});
test("failed marks keep unread status and failed refreshes do not invent zero counts", async () => {
  let fail = false; const store = createBidNoticeStore({ read: async () => { if (fail) throw Error("Read unavailable"); return result; }, mark: async () => { throw Error("Save unconfirmed"); } });
  store.activate(true); await pause(); await store.markRead(["5"]);
  assert.equal(unreadBidCount(store.getSnapshot()), 1); assert.equal(store.getSnapshot().error, "Save unconfirmed");
  fail = true; await store.refresh(); assert.equal(unreadBidCount(store.getSnapshot()), 1); assert.equal(store.getSnapshot().error, "Read unavailable"); store.activate(false);
});
test("sign-out and offline transitions clear private bids and discard delayed results", async () => {
  let release; const store = createBidNoticeStore({ read: () => new Promise(resolve => release = resolve) });
  store.activate(true); store.activate(false); release(result); await pause();
  assert.equal(unreadBidCount(store.getSnapshot()), null); assert.deepEqual(store.getSnapshot().items, []);
});
test("requests use the signed-in account token and reject stale accounts before fetching", async () => {
  let calls = 0; const client = { auth: { getSession: async () => ({ data: { session: { user: { id: "owner" }, access_token: "token" } } }) } };
  const fetchImpl = async (url, request) => { calls++; assert.equal(url, "/api/marketplace/bid-notifications"); assert.equal(request.headers.Authorization, "Bearer token"); assert.equal(request.method, "POST"); return Response.json(result); };
  await requestBidNotices(client, "owner", { ids: ["5"], fetchImpl });
  await assert.rejects(requestBidNotices(client, "other", { fetchImpl }), /Sign in again/); assert.equal(calls, 1);
});
test("session and response parsing stalls are bounded; cancellation cannot start a mark", async () => {
  const pending = { auth: { getSession: () => new Promise(() => {}) } };
  await assert.rejects(requestBidNotices(pending, "owner", { timeoutMs: 10 }), /timed out/);
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: "owner" }, access_token: "token" } } }) } };
  await assert.rejects(requestBidNotices(client, "owner", { timeoutMs: 10, fetchImpl: async () => ({ json: () => new Promise(() => {}) }) }), /timed out/);
  const controller = new AbortController(); controller.abort(); let calls = 0;
  await assert.rejects(requestBidNotices(client, "owner", { ids: ["5"], signal: controller.signal, fetchImpl: () => { calls++; } })); assert.equal(calls, 0);
});
