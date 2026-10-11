import test from "node:test";
import assert from "node:assert/strict";
import { bidIncreaseChoices, bidIncrementSettings, minimumMarketplaceBid, validateMinimumBid, readBidIncrementCapability } from "../lib/bid-increments.mjs";

test("increase choices are exactly the amounts from 10 to 1000 divisible by both 10 and 20", () => {
  assert.equal(bidIncreaseChoices.length, 50);
  assert.equal(bidIncreaseChoices[0], 20);
  assert.equal(bidIncreaseChoices.at(-1), 1000);
  for (const amount of bidIncreaseChoices) {
    assert.equal(amount % 10, 0); assert.equal(amount % 20, 0);
    assert.equal(bidIncrementSettings({ auction_bid_increment: amount }).value, `${amount}.00`);
  }
});
test("minimum bid uses the current price or higher starting price plus the chosen increase", () => {
  assert.equal(minimumMarketplaceBid({ current_bid: 100, starting_price: 90 }, { auction_bid_increment: 20 }), "120.00");
  assert.equal(minimumMarketplaceBid({ current_bid: 20, starting_price: 100 }, { auction_bid_increment: 1000 }), "1100.00");
  assert.equal(minimumMarketplaceBid({ current_bid: "100.05" }, { auction_bid_increment: 40 }), "140.05");
  assert.equal(minimumMarketplaceBid({ current_bid: "99999999990000.11" }, { auction_bid_increment: 20 }), "99999999990020.11");
});
test("legacy one-cent terms remain intact while malformed or unsupported rules fail closed", () => {
  assert.equal(minimumMarketplaceBid({ current_bid: "100.10" }, {}), "100.11");
  for (const value of [0, -20, 10, 30, 1001, 1020, "1e2", "NaN", "Infinity", "20.001"]) {
    assert.throws(() => minimumMarketplaceBid({ current_bid: 100 }, { auction_bid_increment: value }));
  }
  assert.throws(() => minimumMarketplaceBid({ current_bid: "99999999999999.99" }, {}), /limit/);
});
test("exact minimum and larger bids pass; one cent below, excess precision and overflow fail", () => {
  const auction = { current_bid: "100.10" }, product = { auction_bid_increment: 20 };
  assert.equal(validateMinimumBid("120.10", auction, product), "120.10");
  assert.equal(validateMinimumBid("121", auction, product), "120.10");
  for (const value of ["120.09", "120.101", "1e3", "-120", "NaN", "100000000000000.00"]) assert.throws(() => validateMinimumBid(value, auction, product));
});
test("settings are enabled only by the installed database policy", async () => {
  for (const result of [{ data: null }, { data: true }, { data: [] }, { data: "amount-steps-v1", error: {} }]) {
    await assert.rejects(readBidIncrementCapability({ rpc: async () => result }), /Could not check/);
  }
  assert.equal(await readBidIncrementCapability({ rpc: async () => ({ error: { code: "PGRST202" } }) }), false);
  assert.equal(await readBidIncrementCapability({ rpc: async name => { assert.equal(name, "marketplace_bid_increment_policy"); return { data: "amount-steps-v1" }; } }), true);
  await assert.rejects(readBidIncrementCapability({ rpc: async () => { throw Error("offline"); } }), /Could not check/);
});
