import test from "node:test";
import assert from "node:assert/strict";
import { metaPixelConfiguration, validMetaPixelId } from "../lib/meta-pixel-config.mjs";
import { createMetaPixel, metaConsentKey, metaItemData, metaPageKind, metaPurchaseData, metaReferrerSafe, readMetaConsent } from "../lib/meta-pixel.mjs";
const pixelId = "123456789012345", owner = "11111111-1111-4111-8111-111111111111";
const now = Date.parse("2026-10-25T12:00:00Z"), activatedAt = "2026-10-25T09:00:00Z", consentSince = Date.parse("2026-10-25T10:00:00Z");
const order = { id: "22222222-2222-4222-8222-222222222222", buyer_id: owner, product_id: 4, status: "paid", paid_at: "2026-10-25T11:00:00Z", quantity: 2, unit_price: "100.00", total: "265.00", address: "PRIVATE ADDRESS", phone: "PRIVATE PHONE", payment_reference: "PRIVATE PAYMENT", payment_details: { gcash: { account: "PRIVATE ACCOUNT" } } };
const purchase = value => metaPurchaseData(value, { userId: owner, consentSince, activatedAt, now });
function fixture(options = {}) {
  const calls = [], scripts = [], stored = options.stored || new Map(); let active = options.enabled ?? true;
  const browser = { location: new URL(options.url || "https://pinoybuynsell.com/"),
    localStorage: { getItem: key => { if (options.storageError) throw Error("Blocked"); return stored.get(key) || null; }, setItem: (key, value) => { if (options.storageError) throw Error("Blocked"); stored.set(key, value); } } };
  const document = { referrer: options.referrer || "", createElement: () => ({ dataset: {} }), head: { appendChild: script => scripts.push(script) } };
  const driver = createMetaPixel({ pixelId: options.pixelId ?? pixelId, browser, document, enabled: () => active });
  const load = () => { const q = browser.fbq.queue; browser.fbq.callMethod = (...args) => calls.push(args); for (const args of q) browser.fbq.callMethod(...args); browser.fbq.queue = []; scripts[0].onload(); };
  return { driver, browser, calls, scripts, stored, load, active(value) { active = value; }, events: () => calls.filter(call => call[0] === "trackSingle") };
}
test("invalid or disabled Pixel configuration cannot activate tracking", () => {
  assert.deepEqual(metaPixelConfiguration({ NEXT_PUBLIC_META_PIXEL_ID: "disabled", META_PIXEL_ACTIVATED_AT: "disabled" }), { pixelId: "", activatedAt: "" });
  for (const bad of ["", "123", "0", "a1234567", "<script>", "12345678901234567890123456", 123456789]) assert(!validMetaPixelId(bad));
  assert(validMetaPixelId(pixelId));
  assert.deepEqual(metaPixelConfiguration({ NEXT_PUBLIC_META_PIXEL_ID: pixelId, META_PIXEL_ACTIVATED_AT: activatedAt }), { pixelId, activatedAt });
});
test("public routes accept ordinary ad attribution without exposing private destinations or search strings", () => {
  for (const path of ["/", "/product/4", "/collectibles", "/auctions", "/usa-shopping#usa-quote", `/usa-shopping?item=${owner}#usa-quote`, `/usa-shopping/item/${owner}`, "/?fbclid=IwAR123456&utm_campaign=cards"]) assert.equal(metaPageKind(`https://pinoybuynsell.com${path}`), "public", path);
  for (const path of ["/login", "/login?code=secret", "/reset-password#access_token=secret", "/verify", "/admin/facebook", "/account/checkout?listing=4", "/api/marketplace/payments/receipts?orderId=secret", "/search?q=customer%40mail.com", "/product/4?code=secret", "/?utm_campaign=private%40mail.com", "/usa-shopping?item=wrong", "/account/orders?order=private", "/?unknown=secret"]) assert.equal(metaPageKind(`https://pinoybuynsell.com${path}`), null, path);
  assert.equal(metaPageKind("https://pinoybuynsell.com/account/orders"), "purchase");
});
test("sensitive referral queries cannot be forwarded by the Pixel library", () => {
  for (const url of ["", "https://facebook.com/", "https://pinoybuynsell.com/product/4"]) assert(metaReferrerSafe(url));
  for (const url of ["https://pinoybuynsell.com/login?code=secret", "https://pinoybuynsell.com/account/orders?order=private", "not a URL"]) assert(!metaReferrerSafe(url));
});
test("malformed or unavailable consent storage never silently opts a visitor in", () => {
  assert.equal(readMetaConsent({ getItem: () => "not-json" }), null);
  for (const saved of [{ choice: "allow" }, { choice: true, since: 100 }, { choice: "allow", since: -1 }]) assert.equal(readMetaConsent({ getItem: () => JSON.stringify(saved) }), null);
  assert.equal(readMetaConsent({ getItem() { throw Error("Blocked"); } }), null);
  assert.deepEqual(readMetaConsent({ getItem: key => { assert.equal(key, metaConsentKey); return JSON.stringify({ choice: "deny", since: 100 }); } }), { choice: "deny", since: 100 });
});
test("view events contain public identifiers and genuine fixed prices, without private/freeform data", () => {
  const product = { id: 4, status: "active", listing_type: "fixed_price", price: 100, description: "PRIVATE", seller_id: owner, title: "PRIVATE TITLE" };
  assert.deepEqual(metaItemData(product), { content_ids: ["4"], content_type: "product", value: 100, currency: "PHP" });
  assert.deepEqual(metaItemData({ ...product, listing_type: "auction" }), { content_ids: ["4"], content_type: "product" });
  assert.deepEqual(metaItemData({ id: owner, status: "published", usd_price: 100 }, true), { content_ids: [`usa:${owner}`], content_type: "product" });
  for (const patch of [{ status: "sold" }, { deleted_at: "2026-10-25" }, { relisted_to_id: 5 }, { id: "unsafe" }]) assert.equal(metaItemData({ ...product, ...patch }), null);
});
test("only a current buyer's recent, confirmed, post-consent payment creates purchase data", () => {
  const event = purchase(order);
  assert.equal(event.eventID, `purchase:${order.id}`); assert.equal(event.data.value, 265); assert.equal(event.data.currency, "PHP");
  assert.deepEqual(event.data.contents, [{ id: "4", quantity: 2, item_price: 100 }]);
  for (const patch of [{ status: "awaiting_payment" }, { status: "payment_submitted" }, { status: "cancelled" }, { buyer_id: "other" }, { paid_at: null }, { paid_at: "2026-10-24T10:00:00Z" }, { paid_at: "2026-10-25T10:00:00Z", total: -1 }, { paid_at: "2026-10-25T14:00:00Z" }, { product_id: null }, { quantity: 1.5 }]) assert.equal(purchase({ ...order, ...patch }), null, JSON.stringify(patch));
  assert.equal(metaPurchaseData(order, { userId: owner, consentSince, activatedAt: "", now }), null);
  for (const secret of [order.address, order.phone, order.payment_reference, "PRIVATE ACCOUNT", owner]) assert(!JSON.stringify(event).includes(secret));
});
test("missing ID, declined consent, private paths and sensitive referrers never request Meta code", () => {
  for (const options of [{ pixelId: "" }, { enabled: false }, { url: "https://pinoybuynsell.com/login?code=secret" }, { referrer: "https://pinoybuynsell.com/login?code=secret" }]) {
    const f = fixture(options); f.driver.sync(); assert.equal(f.scripts.length, 0); assert.equal(f.browser.fbq, undefined);
  }
});
test("a permitted Pixel loads once, disables automatic matching/configuration, and sends one initial page view", () => {
  const f = fixture(); f.driver.sync(); f.driver.sync(); assert.equal(f.scripts.length, 1); assert.equal(f.events().length, 0);
  assert.equal(f.browser.fbq.push, f.browser.fbq);
  assert.equal(f.scripts[0].src, "https://connect.facebook.net/en_US/fbevents.js"); f.load(); f.driver.sync(); f.driver.sync();
  assert(f.calls.some(call => JSON.stringify(call) === JSON.stringify(["set", "autoConfig", false, pixelId])));
  assert(f.calls.some(call => JSON.stringify(call) === JSON.stringify(["init", pixelId])));
  assert.deepEqual(f.events(), [["trackSingle", pixelId, "PageView"]]);
});
test("navigation and item effects cannot duplicate an event or report a stale item's ID", () => {
  const f = fixture({ url: "https://pinoybuynsell.com/product/4" }); f.driver.sync(); f.load();
  const item = { id: 4, status: "active", listing_type: "fixed_price", price: 100 };
  assert.equal(f.driver.item(item), true); assert.equal(f.driver.item(item), false);
  assert.equal(f.events().filter(call => call[2] === "ViewContent").length, 1);
  f.browser.location = new URL("https://pinoybuynsell.com/product/5"); f.driver.sync();
  assert.equal(f.driver.item(item), false); assert.equal(f.driver.item({ ...item, id: 5 }), true);
  f.browser.location = new URL("https://pinoybuynsell.com/login"); f.driver.sync(); const count = f.events().length;
  assert.equal(f.driver.item(item), false); assert.equal(f.events().length, count);
  f.browser.location = new URL("https://pinoybuynsell.com/product/4"); f.driver.sync(); assert.equal(f.driver.item(item), true);
});
test("revocation during library loading does not leave any queued tracking calls", () => {
  const f = fixture(); f.driver.sync(); f.active(false); f.driver.revoke(); f.load(); f.driver.sync();
  assert.deepEqual(f.calls[0], ["consent", "revoke"]);
  assert.equal(f.events().length, 0); assert(!f.calls.some(call => call[0] === "consent" && call[1] === "grant"));
});
test("purchase events are buyer-page-only, exclude page views, and deduplicate across reloads", () => {
  const f = fixture({ url: "https://pinoybuynsell.com/account/orders" }); f.driver.sync(); assert.equal(f.scripts.length, 0);
  f.driver.purchase(purchase(order)); f.load(); f.driver.sync();
  assert.equal(f.events().length, 0); assert.equal(f.driver.purchase(purchase(order)), true); assert.equal(f.driver.purchase(purchase(order)), false);
  assert.deepEqual(f.events(), [["trackSingle", pixelId, "Purchase", purchase(order).data, { eventID: purchase(order).eventID }]]);
  const reload = fixture({ url: "https://pinoybuynsell.com/account/orders", stored: f.stored }); reload.driver.sync();
  assert.equal(reload.driver.purchase(purchase(order)), false); assert.equal(reload.events().length, 0);
  f.browser.location = new URL("https://pinoybuynsell.com/account/orders?order=private"); assert.equal(f.driver.purchase(purchase(order)), false);
});
test("blocked storage and an ad blocker cannot break browsing or payment confirmation", () => {
  const f = fixture({ url: "https://pinoybuynsell.com/account/orders", storageError: true }); f.driver.purchase(purchase(order)); f.load();
  assert.equal(f.driver.purchase(purchase(order)), true); assert.equal(f.driver.purchase(purchase(order)), false);
  const blocked = fixture(); blocked.driver.sync(); blocked.scripts[0].onerror(); blocked.driver.sync(); assert.equal(blocked.scripts.length, 1); assert.equal(blocked.events().length, 0);
});
test("an advertising SDK exception cannot break an item or mark a purchase as reported", () => {
  const f = fixture({ url: "https://pinoybuynsell.com/product/4" }); f.driver.sync(); f.load();
  f.browser.fbq.callMethod = () => { throw Error("External advertising failure"); };
  assert.doesNotThrow(() => f.driver.sync()); assert.doesNotThrow(() => f.driver.revoke());
  assert.equal(f.driver.item({ id: 4, status: "active" }), false);
  f.browser.location = new URL("https://pinoybuynsell.com/account/orders");
  assert.equal(f.driver.purchase(purchase(order)), false); assert.equal(f.stored.size, 0);
});
