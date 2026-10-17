import test from "node:test";
import assert from "node:assert/strict";
import { listingHashtags, appendListingHashtags } from "../lib/listing-hashtags.mjs";
import { facebookCaption } from "../lib/facebook-caption.mjs";

const jordan = { id: 7, title: "Upper Deck Michael Jordan #79 PSA 8", category: "Collectibles", listing_type: "fixed_price", status: "active", price: 5000, quantity: 1 };

test("basketball card posts get short, relevant item and Philippines hashtags", () => {
  const tags = listingHashtags(jordan);
  for (const tag of ["#PinoyBuyNSell", "#BuyAndSellPH", "#TradingCardsPH", "#BasketballCards", "#MichaelJordan", "#ForSalePH"]) assert(tags.includes(tag));
  assert(!tags.includes("#PokemonTCG")); assert(!tags.includes("#TCGPhilippines"));
  assert.equal(new Set(tags).size, tags.length); assert(tags.length <= 6);
});

test("Pokemon spelling and auction hashtags work without treating every collectible as a TCG", () => {
  const tags = listingHashtags({ ...jordan, title: "Pokémon TCG Elite Trainer Box", listing_type: "auction" });
  assert(tags.includes("#PokemonTCG")); assert(tags.includes("#TCGPhilippines")); assert(tags.includes("#OnlineAuctionPH"));
  assert(!tags.includes("#BasketballCards")); assert(!tags.includes("#ForSalePH"));
  for (const title of ["Pokémon plush toy", "Magic trick deck", "Michael Jordan jersey", "Playing cards gift set"]) {
    const result = listingHashtags({ ...jordan, title });
    assert(!result.includes("#TCGPhilippines")); assert(!result.includes("#TradingCardsPH"));
  }
});

test("non-card listings use their own category without unrelated card or shipping tags", () => {
  for (const [category, title, expected] of [["Phones", "iPhone 15", "#PhonesPH"], ["Electronics", "Garmin smartwatch", "#ElectronicsPH"], ["Home & Living", "Coffee table", "#HomeAndLivingPH"], ["Fashion", "Sneakers", "#FashionPH"]]) {
    const tags = listingHashtags({ ...jordan, category, title });
    assert(tags.includes(expected)); assert(!tags.includes("#TradingCardsPH")); assert(!tags.includes("#USAtoPhilippines"));
  }
});

test("known TCG names and Alex or Alexandra Eala card titles get the appropriate topics", () => {
  for (const [title, tag] of [["Yu-Gi-Oh card", "#YuGiOhTCG"], ["Magic: The Gathering Bloomburrow", "#MagicTheGathering"], ["One Piece TCG booster", "#OnePieceTCG"], ["Alex Eala tennis card", "#AlexEala"], ["2026 Topps Now Tennis #18 ALEXANDRA EALA First WTA Title", "#AlexEala"]]) {
    const tags = listingHashtags({ ...jordan, title });
    assert(tags.includes(tag)); assert(tags.includes("#TradingCardsPH")); assert(tags.length <= 6);
  }
});

test("hashtag inference ignores private fields, arbitrary descriptions and unknown categories", () => {
  const clean = { title: "Selected item", category: "__proto__" };
  assert.deepEqual(listingHashtags({ ...clean, description: "Pokemon TCG", seller_id: "private-id", contact_phone: "09000000000", contact_email: "private@example.com", location: "Private street" }), listingHashtags(clean));
  for (const value of [null, undefined, {}, { title: {}, category: [] }, { title: "#".repeat(10000), category: "#Untrusted" }]) {
    const tags = listingHashtags(value);
    assert(tags.length >= 2 && tags.length <= 6); assert(tags.every(tag => /^#[A-Za-z][A-Za-z0-9]*$/.test(tag)));
  }
  const sold = listingHashtags({ ...jordan, status: "sold" });
  assert(!sold.includes("#ForSalePH")); assert(!sold.includes("#OnlineAuctionPH"));
});

test("automatic tags respect manually supplied hashtags and are idempotent", () => {
  const source = "A card for collectors. #pinoybuynsell #BUYANDSELLPH #MyOwnTag";
  const caption = appendListingHashtags(source, jordan);
  assert(caption.startsWith(source)); assert.equal((caption.match(/#pinoybuynsell/gi) || []).length, 1);
  assert.equal((caption.match(/#buyandsellph/gi) || []).length, 1); assert(caption.includes("#MyOwnTag"));
  assert.equal(appendListingHashtags(caption, jordan), caption);
  const many = listingHashtags({ ...jordan, title: "Pokemon TCG Yu-Gi-Oh MTG Michael Jordan basketball cards" });
  assert(many.length <= 6); assert.equal(many.at(-1), "#ForSalePH");
});

test("shared Facebook caption preserves item, shipping and payment details before appending tags", () => {
  const item = { ...jordan, description: "A graded card. #PinoyBuyNSell", shipping_carrier: "J&T Express", shipping_fee: 85, seller_id: "private-id", contact_email: "private@example.com" };
  const caption = facebookCaption(item);
  assert(caption.startsWith(item.title)); assert.match(caption, /₱5,000\.00/); assert.match(caption, /J&T Express.*₱85\.00/);
  assert(caption.includes("https://pinoybuynsell.com/product/7")); assert(caption.includes("GCash or bank deposit only"));
  assert(caption.includes("#MichaelJordan")); assert(caption.endsWith("#ForSalePH"));
  assert.equal((caption.match(/#PinoyBuyNSell/gi) || []).length, 1);
  assert(!caption.includes("private-id")); assert(!caption.includes("private@example.com"));
});
