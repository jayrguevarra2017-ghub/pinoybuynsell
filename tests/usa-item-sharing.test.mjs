import test from "node:test";
import assert from "node:assert/strict";
import { readPublicUSAItems } from "../lib/public-usa-items.mjs";
import { usaItemCaption, usaItemHashtags, usaItemMetadata, usaItemUrl, usaItemShareUrl, usaFacebookJobId, usaQuotePath, canPublishUSAItem } from "../lib/usa-item-sharing.mjs";
import { publishUSAItem } from "../lib/usa-facebook-posting.mjs";

const id = "11111111-1111-4111-8111-111111111111", admin = "22222222-2222-4222-8222-222222222222";
const item = { id, admin_id: admin, title: "Topps Now Michael Jordan NBA card PSA 10", description: "A selected card.", item_url: "https://www.ebay.com/itm/card", store: "eBay", status: "published", usd_price: 25,
  image_path: `${admin}/33333333-3333-4333-8333-333333333333.jpg`, contact_name: "Private customer", private_notes: "Private shipping address" };

test("USA share links lead to a specific public item and retain a safe quote handoff", () => {
  assert.equal(usaItemUrl(id), `https://pinoybuynsell.com/usa-shopping/item/${id}`);
  assert.equal(new URL(usaItemShareUrl(id)).searchParams.get("u"), usaItemUrl(id));
  assert.equal(usaQuotePath(id), `/usa-shopping?item=${id}#usa-quote`);
  assert.equal(usaFacebookJobId(id), `usa:${id}`);
  for (const invalid of ["4", "../private", "id#secret", "", null, 4]) {
    assert.equal(usaItemUrl(invalid), null); assert.equal(usaItemShareUrl(invalid), null); assert.equal(usaFacebookJobId(invalid), null);
  }
});
test("USA captions use reference USD prices, quote terms, item and website tags without private fields", () => {
  const caption = usaItemCaption(item);
  for (const text of [item.title, "Reference store price: $25.00 USD", "Source store: eBay", "shipping and import charges", usaItemUrl(id), "#PinoyBuyNSell", "#BuyAndSellPH", "#USAtoPhilippines", "#USAShopping", "#MichaelJordan", "#PSA10", "#Topps"]) assert(caption.includes(text), text);
  for (const text of [item.contact_name, item.private_notes, "₱", "#OnlineAuctionPH", "#ForSalePH", "COD"]) assert(!caption.includes(text), text);
  assert(usaItemHashtags(item).length <= 10);
  assert(!usaItemCaption({ ...item, usd_price: null }).includes("Reference store price"));
  assert(!usaItemCaption({ ...item, usd_price: -1 }).includes("Reference store price"));
  assert(usaItemCaption({ ...item, usd_price: 0 }).includes("$0.00 USD"));
});
test("USA item tags reuse the title allowlist, infer obvious items and deduplicate manual hashtags", () => {
  assert(usaItemHashtags({ title: "Canon mirrorless camera" }).includes("#CameraGear"));
  assert(usaItemHashtags({ title: "Nike sneakers" }).includes("#Nike"));
  const tags = usaItemHashtags({ title: "Ordinary box", description: "iPhone PSA 10 Michael Jordan", private_notes: "Nike" });
  assert.deepEqual(tags, ["#PinoyBuyNSell", "#BuyAndSellPH", "#USAtoPhilippines", "#USAShopping"]);
  const caption = usaItemCaption({ ...item, description: "#pinoybuynsell #USAtoPhilippines" });
  assert.equal(caption.match(/#pinoybuynsell/gi).length, 1); assert.equal(caption.match(/#USAtoPhilippines/gi).length, 1);
});
test("only the trusted administrator owning a published USA card gets the Page action", () => {
  assert(canPublishUSAItem(item, { id: admin }, true));
  for (const candidate of [null, { ...item, status: "draft" }, { ...item, status: "archived" }, { ...item, admin_id: "other" }]) assert(!canPublishUSAItem(candidate, { id: admin }, true));
  assert(!canPublishUSAItem(item, { id: admin }, false)); assert(!canPublishUSAItem(item, null, true));
});
test("USA Facebook previews use the item photo, title, canonical URL and truthful reference price", () => {
  const meta = usaItemMetadata(item, "https://example.supabase.co");
  assert(meta.title.includes(item.title)); assert.equal(meta.alternates.canonical, usaItemUrl(id));
  assert.equal(meta.openGraph.url, usaItemUrl(id)); assert.equal(meta.openGraph.images[0].alt, item.title);
  assert.equal(meta.openGraph.images[0].url, `https://example.supabase.co/storage/v1/object/public/listing-photos/${item.image_path}`);
  assert(meta.description.includes("Reference price $25.00 USD")); assert(meta.description.includes("quoted separately"));
  assert.equal(meta.twitter.card, "summary_large_image"); assert(!JSON.stringify(meta).includes(item.private_notes));
  for (const path of ["identity-documents/private.jpg", "../../private.jpg"]) assert.deepEqual(usaItemMetadata({ ...item, image_path: path }, "https://example.supabase.co").openGraph.images, []);
  assert.deepEqual(usaItemMetadata(item, "http://example.supabase.co").openGraph.images, []);
});
test("single USA item reads use exact UUID and public projection and never disclose other/draft records", async () => {
  let calls = 0;
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" };
  const rows = await readPublicUSAItems({ env, itemId: id, fetchImpl: async (url, options) => {
    calls++; const params = new URL(url).searchParams;
    assert.equal(params.get("id"), `eq.${id}`); assert.equal(params.get("status"), "eq.published"); assert.equal(params.get("limit"), "1");
    assert(!params.get("select").includes("admin_id")); assert.equal(options.headers.Authorization, "Bearer anon");
    return Response.json([item, { ...item, id: admin }, { ...item, status: "draft" }]);
  } });
  assert.equal(rows.length, 1); assert.equal(rows[0].id, id); assert(!Object.hasOwn(rows[0], "admin_id")); assert(!Object.hasOwn(rows[0], "private_notes"));
  assert.deepEqual(await readPublicUSAItems({ env, itemId: "id.or.(status.eq.draft)", fetchImpl: () => { calls++; } }), []);
  assert.equal(calls, 1);
});
test("USA Page client sends only the selected ID and authorization, once on explicit invocation", async () => {
  let calls = 0;
  const result = await publishUSAItem({ auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } } }) } }, id, {
    fetchImpl: async (url, options) => {
      calls++; assert.equal(url, "/api/facebook/usa/publish"); assert.equal(options.headers.Authorization, "Bearer test-token");
      assert.deepEqual(JSON.parse(options.body), { itemId: id });
      return Response.json({ status: "published", message: "USA item posted to Facebook." });
    },
  });
  assert.equal(calls, 1); assert.equal(result.status, "published");
});
test("USA Page client bounds stalled sessions, response bodies and requests without retrying", async () => {
  let calls = 0;
  await assert.rejects(publishUSAItem({ auth: { getSession: () => new Promise(() => {}) } }, id, { sessionTimeoutMs: 5 }), /timed out/);
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } } }) } };
  for (const hangBody of [false, true]) await assert.rejects(publishUSAItem(client, id, { timeoutMs: 5, fetchImpl: async () => {
    calls++; return hangBody ? { json: () => new Promise(() => {}) } : new Promise(() => {});
  } }), /timed out/);
  assert.equal(calls, 2);
  await assert.rejects(publishUSAItem({ auth: { getSession: async () => ({ data: {} }) } }, id), /Sign in/);
});
