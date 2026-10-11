import test from "node:test";
import assert from "node:assert/strict";
import { submitMarketplaceBid } from "../lib/marketplace-bidding.mjs";

const time = Date.parse("2026-10-10T00:00:00Z");
const input = { user: { id: "buyer" }, product: { id: 1, seller_id: "seller", status: "active", listing_type: "auction" },
  auction: { id: 4, current_bid: 100, starting_price: 90, status: "active", starts_at: new Date(time - 1000).toISOString(), ends_at: new Date(time + 1000).toISOString() }, amountText: "150" };
function fixture({ verified = true, verifyError = null, verifyPending = false, bidPending = false, result = { data: { ...input.auction, current_bid: 150 } } } = {}) {
  const calls = [];
  const client = { rpc: async (name, args) => { calls.push({ name, args });
    if (name === "is_marketplace_verified") return verifyPending ? new Promise(() => {}) : { data: verified, error: verifyError };
    return bidPending ? new Promise(() => {}) : result;
  } };
  return { calls, run: (value = input, options = {}) => submitMarketplaceBid(client, value, { now: () => time, timeoutMs: 10, ...options }) };
}
test("bidding rejects invalid amounts, guests, self-bids and unavailable auctions before any RPC", async () => {
  const cases = [{ ...input, user: null }, { ...input, user: { id: "seller" } },
    { ...input, product: { ...input.product, status: "sold" } }, { ...input, product: { ...input.product, deleted_at: "today" } },
    { ...input, product: { ...input.product, listing_type: "fixed_price" } },
    { ...input, auction: { ...input.auction, ends_at: new Date(time).toISOString() } },
    { ...input, auction: { ...input.auction, starts_at: new Date(time + 500).toISOString() } },
    ...["100", "0", "-1", "NaN", "150.123", "1e3"].map(amountText => ({ ...input, amountText }))];
  for (const value of cases) { const f = fixture(); await assert.rejects(f.run(value)); assert.equal(f.calls.length, 0); }
});
test("only an explicitly verified buyer reaches the bid mutation", async () => {
  for (const options of [{ verified: false }, { verified: {} }, { verifyError: {} }, { verifyPending: true }]) {
    const f = fixture(options); await assert.rejects(f.run()); assert.deepEqual(f.calls.map(call => call.name), ["is_marketplace_verified"]);
  }
});
test("a listing or sign-in change, or an auction closing during verification, cannot submit a bid", async () => {
  const changed = fixture(); await assert.rejects(changed.run(input, { isCurrent: () => false }), /changed/);
  assert.equal(changed.calls.length, 1);
  let reads = 0; const ended = fixture();
  await assert.rejects(ended.run(input, { now: () => ++reads === 1 ? time : time + 1000 }), /not open/);
  assert.equal(ended.calls.length, 1);
});
test("successful bids require the matching auction and a confirmed current price", async () => {
  const f = fixture(); const result = await f.run(); assert.equal(result.current_bid, 150);
  assert.deepEqual(f.calls[1], { name: "place_marketplace_bid", args: { p_auction_id: "4", p_amount: "150" } });
  for (const data of [null, {}, { id: 5, current_bid: 150 }, { id: 4, current_bid: 100 }, { id: 4, current_bid: "NaN" }]) {
    const bad = fixture({ result: { data } }); await assert.rejects(bad.run(), /Could not confirm/); assert.equal(bad.calls.length, 2);
  }
});
test("configured minimum increments reject smaller bids before any mutation", async () => {
  const product = { ...input.product, auction_bid_increment: 60 };
  const rejected = fixture();
  await assert.rejects(rejected.run({ ...input, product }), /at least ₱160/);
  assert.equal(rejected.calls.length, 0);
  const accepted = fixture({ result: { data: { ...input.auction, current_bid: 160 } } });
  await accepted.run({ ...input, product, amountText: "160" });
  assert.equal(accepted.calls.length, 2);
});
test("rejected or stalled bid writes finish without automatically submitting another bid", async () => {
  for (const options of [{ bidPending: true }, { result: { error: { code: "PGRST202" } } }, { result: { error: { message: "Your bid must exceed the current bid." } } }]) {
    const f = fixture(options); await assert.rejects(f.run()); assert.equal(f.calls.filter(call => call.name === "place_marketplace_bid").length, 1);
  }
});
