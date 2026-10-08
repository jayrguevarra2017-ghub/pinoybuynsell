import { test } from "node:test";
import assert from "node:assert/strict";
import { auctionClock } from "../lib/auction-clock.mjs";

const now = Date.parse("2030-10-09T10:00:00Z");
test("countdown includes days and decreases every second", () => {
  const options = { endTime: "2030-10-11T13:04:05Z" };
  assert.equal(auctionClock(options, now).text, "2d 03h 04m 05s");
  assert.equal(auctionClock(options, now + 1000).text, "2d 03h 04m 04s");
});
test("expiry is exact and never displays negative time", () => {
  const options = { endTime: "2030-10-09T10:00:01Z" };
  assert.equal(auctionClock(options, now + 999).text, "00h 00m 01s");
  for (const timestamp of [now + 1000, now + 5000]) {
    assert.equal(auctionClock(options, timestamp).state, "ended");
    assert.equal(auctionClock(options, timestamp).text, "Auction ended");
  }
});
test("scheduled bidding transitions from start countdown to closing countdown", () => {
  const options = { startsAt: "2030-10-09T10:00:05Z", endTime: "2030-10-09T11:00:00Z" };
  assert.equal(auctionClock(options, now).label, "Bidding starts in");
  assert.equal(auctionClock(options, now).text, "00h 00m 05s");
  assert.equal(auctionClock(options, now + 5000).label, "Time left to bid");
  assert.equal(auctionClock(options, now + 5000).text, "00h 59m 55s");
});
test("closed auctions and invalid timestamps cannot show an active countdown", () => {
  assert.equal(auctionClock({ endTime: "2030-10-10T10:00:00Z", status: "ended" }, now).state, "ended");
  for (const options of [{ endTime: null }, { endTime: "bad" }, { endTime: "2030-10-10T10:00:00Z", startsAt: "bad" },
    { endTime: "2030-10-10T10:00:00Z", startsAt: "2030-10-11T10:00:00Z" }]) {
    const result = auctionClock(options, now);
    assert.equal(result.state, "unavailable");
    assert.doesNotMatch(result.text, /NaN/);
  }
});
test("timestamps represent the same deadline regardless of timezone notation", () => {
  assert.deepEqual(auctionClock({ endTime: "2030-10-09T18:01:00+08:00" }, now),
    auctionClock({ endTime: "2030-10-09T10:01:00Z" }, now));
});
