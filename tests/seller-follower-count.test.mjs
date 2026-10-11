import test from "node:test";
import assert from "node:assert/strict";
import { readSellerFollowerCount, followerCountError } from "../lib/seller-follower-count.mjs";

const id = "11111111-1111-4111-8111-111111111111";
const client = profile => ({ rpc: () => Promise.resolve({ data: profile }) });

test("admin follower totals come from the existing aggregate for the correct profile", async () => {
  const signal = new AbortController().signal;
  const api = { rpc(name, args) {
    assert.equal(name, "marketplace_seller_profile"); assert.deepEqual(args, { p_seller_id: id });
    return { abortSignal(value) { assert.equal(value, signal); return Promise.resolve({ data: { id, follower_count: 12 } }); } };
  } };
  assert.equal(await readSellerFollowerCount(api, id, { signal }), 12);
  assert.equal(await readSellerFollowerCount(client({ id, follower_count: 0 }), id), 0);
});

test("missing, malformed or another account's totals never produce a made-up zero", async () => {
  for (const profile of [null, {}, { id: "22222222-2222-4222-8222-222222222222", follower_count: 12 },
    { id, follower_count: -1 }, { id, follower_count: "12" }, { id, follower_count: 1.5 }, { id, follower_count: Number.MAX_SAFE_INTEGER + 1 }])
    await assert.rejects(() => readSellerFollowerCount(client(profile), id), error => error.message === followerCountError);
  await assert.rejects(() => readSellerFollowerCount({ rpc() { throw Error("must not request"); } }, "bad-id"), error => error.message === followerCountError);
});

test("failed and stalled follower reads return safe errors and support cancellation", async () => {
  for (const operation of [Promise.resolve({ error: { message: "private-provider-details" } }), new Promise(() => {})])
    await assert.rejects(() => readSellerFollowerCount({ rpc: () => operation }, id, { timeoutMs: 10 }), error => error.message === followerCountError);
  const c = new AbortController();
  const pending = readSellerFollowerCount({ rpc: () => ({ abortSignal(signal) { return new Promise((_, reject) => signal.addEventListener("abort", () => reject(Error("Aborted")), { once: true })); } }) }, id, { signal: c.signal });
  c.abort(); await assert.rejects(() => pending, error => error.message === followerCountError);
});
