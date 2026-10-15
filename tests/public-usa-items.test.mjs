import test from "node:test";
import assert from "node:assert/strict";
import { readPublicUSAItems, publicUSAItemFields } from "../lib/public-usa-items.mjs";
const env = { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key", SUPABASE_SERVICE_ROLE_KEY: "private-key" };
const item = { id: "11111111-1111-4111-8111-111111111111", title: "A trading card", item_url: "https://www.amazon.com/dp/CARD", store: "Amazon", description: "A selected collectible.", image_path: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg", status: "published", usd_price: 12, created_at: "2026-10-15T00:00:00Z" };

test("server-rendered USA items use anonymous, uncached, published-only reads", async () => {
  const rows = await readPublicUSAItems({ env, fetchImpl: async (url, options) => {
    const params = new URL(url).searchParams;
    assert.equal(params.get("status"), "eq.published"); assert.equal(params.get("limit"), "100");
    assert.equal(params.get("select"), publicUSAItemFields); assert(!publicUSAItemFields.includes("admin_id"));
    assert.equal(options.headers.apikey, "public-key"); assert.equal(options.headers.Authorization, "Bearer public-key");
    assert.equal(options.cache, "no-store"); assert.equal(options.redirect, "error");
    return Response.json([{ ...item, admin_id: "private-owner", private_notes: "hidden" }]);
  } });
  assert.equal(rows.length, 1); assert.equal(rows[0].title, item.title);
  assert(!Object.hasOwn(rows[0], "admin_id")); assert(!Object.hasOwn(rows[0], "private_notes"));
});
test("USA initial HTML cannot expose drafts, hidden items or unsafe source/photo paths", async () => {
  const rows = await readPublicUSAItems({ env, fetchImpl: async () => Response.json([item,
    { ...item, status: "draft" }, { ...item, status: "archived" }, { ...item, id: "bad-id" },
    { ...item, image_path: "identity-documents/private.png" }, { ...item, item_url: "https://amazon.com.evil.invalid/card" },
    { ...item, store: "eBay" }, null]) });
  assert.deepEqual(rows, [item]);
});
test("B&H published cards are included in initial HTML with the correct store identity", async () => {
  const bh = { ...item, item_url: "https://www.bhphotovideo.com/c/product/123/REG/camera.html", store: "B&H Photo" };
  const rows = await readPublicUSAItems({ env, fetchImpl: async () => Response.json([bh, { ...bh, store: "Amazon" }, { ...bh, item_url: "https://bhphotovideo.com.evil.com/camera" }]) });
  assert.deepEqual(rows, [bh]);
});
test("USA reads fail explicitly for missing setup, malformed bodies and missing configuration", async () => {
  await assert.rejects(readPublicUSAItems({ env: {}, fetchImpl: () => { throw Error("Must not fetch"); } }), /unavailable/);
  for (const response of [Response.json({}, { status: 404 }), Response.json(null), Response.json({ items: [item] })]) {
    await assert.rejects(readPublicUSAItems({ env, fetchImpl: async () => response }), /unavailable/);
  }
});
