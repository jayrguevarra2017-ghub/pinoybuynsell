import { test } from "node:test";
import assert from "node:assert/strict";
import { validateListingOptions, toManilaInput, fromManilaInput } from "../lib/listing-options.mjs";
import { facebookCaption } from "../lib/facebook-publishing.mjs";

const fixed = { listing_type: "fixed_price", quantity: "5", variations: [{ name: "Black", quantity: "2" }, { name: "Blue", quantity: "3" }] };
const auction = { listing_type: "auction", quantity: "1", variations: [], auction_starting_price: "100.50", auction_ends_at: "2030-10-09T18:00:00+08:00" };
test("fixed-price quantity must match variation stock", () => {
  assert.equal(validateListingOptions(fixed), "");
  assert.match(validateListingOptions({ ...fixed, quantity: "6" }), /match/);
  assert.match(validateListingOptions({ ...fixed, quantity: "1.5" }), /whole/);
  assert.match(validateListingOptions({ ...fixed, quantity: "1000001" }), /whole/);
});
test("variation names and stock are validated", () => {
  assert.match(validateListingOptions({ ...fixed, variations: [{ name: "Blue", quantity: "2" }, { name: " blue ", quantity: "3" }] }), /different/);
  assert.match(validateListingOptions({ ...fixed, variations: [{ name: "", quantity: "5" }] }), /name/);
  assert.match(validateListingOptions({ ...fixed, variations: [{ name: "Blue", quantity: "-5" }] }), /whole/);
  assert.equal(validateListingOptions({ ...fixed, quantity: "0", variations: [] }), "");
});
test("auctions require one lot, no selectable variations and valid terms", () => {
  assert.equal(validateListingOptions(auction), "");
  assert.match(validateListingOptions({ ...auction, quantity: "2" }), /one item/);
  assert.match(validateListingOptions({ ...auction, variations: [{ name: "Blue", quantity: "1" }] }), /one item/);
  for (const price of ["0", "-1", "1.001", "NaN", "Infinity"]) assert.match(validateListingOptions({ ...auction, auction_starting_price: price }), /starting bid/);
});
test("only locked existing auction terms can retain a past closing time", () => {
  const past = { ...auction, auction_ends_at: "2020-10-09T18:00:00+08:00" };
  assert.match(validateListingOptions(past), /future/);
  assert.equal(validateListingOptions(past, Date.now(), true), "");
  assert.match(validateListingOptions({ ...auction, auction_ends_at: "invalid" }, Date.now(), true), /future/);
});
test("Philippine closing times round trip without losing seconds", () => {
  const timestamp = "2030-10-09T10:12:34+00:00";
  assert.equal(toManilaInput(timestamp), "2030-10-09T18:12:34");
  assert.equal(fromManilaInput(toManilaInput(timestamp)), "2030-10-09T10:12:34.000Z");
  assert.equal(toManilaInput(null), "");
});
test("Facebook captions reflect auction pricing or variation availability", () => {
  const product = { id: 1, title: "Item", price: 500, ...fixed };
  assert.match(facebookCaption(product), /Quantity available: 5/);
  assert.match(facebookCaption(product), /Blue \(3 available\)/);
  const bidding = facebookCaption({ ...product, ...auction });
  assert.match(bidding, /Auction · starting bid: ₱100\.50/);
  assert.doesNotMatch(bidding, /Price: ₱500/);
});
