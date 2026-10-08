import test from "node:test";
import assert from "node:assert/strict";
import { getPublicPreviewProduct, productPreviewMetadata } from "../lib/product-metadata.mjs";

const env = { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
  SUPABASE_SERVICE_ROLE_KEY: "private-key" };
const path = "00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000002.jpg";
const product = { id: 4, title: "Alex Eala tennis card", description: "New collectible card", price: 1000,
  image_path: path, status: "active", deleted_at: null };

test("preview reads only public active listings with the public key and no stale data cache", async () => {
  let checked = false;
  const result = await getPublicPreviewProduct("4", { env, fetchImpl: async (url, options) => {
    const query = new URL(url).searchParams;
    assert.equal(query.get("id"), "eq.4"); assert.equal(query.get("status"), "eq.active"); assert.equal(query.get("deleted_at"), "is.null");
    assert.ok(!query.get("select").includes("seller_id"));
    assert.equal(options.headers.apikey, "public-key"); assert.equal(options.headers.Authorization, "Bearer public-key");
    assert.equal(options.cache, "no-store"); checked = true;
    return Response.json([product]);
  } });
  assert.ok(checked); assert.deepEqual(result, product);
});
test("metadata has the item title, price, canonical link and public photo", () => {
  const result = productPreviewMetadata("4", product, env.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(result.title, "Alex Eala tennis card | PinoyBuyNSell");
  assert.match(result.description, /₱1,000\.00/);
  assert.equal(result.openGraph.url, "https://pinoybuynsell.com/product/4");
  assert.equal(result.openGraph.images[0].url, `https://example.supabase.co/storage/v1/object/public/listing-photos/${path}`);
  assert.equal(result.twitter.card, "summary_large_image");
});
test("unavailable, deleted, inactive and mismatched listings cannot expose item details", async () => {
  for (const response of [[], [{ ...product, deleted_at: "2026-10-08" }], [{ ...product, status: "draft" }], [{ ...product, id: 5 }]]) {
    const result = await getPublicPreviewProduct("4", { env, fetchImpl: async () => Response.json(response) });
    assert.equal(result, null);
    const metadata = productPreviewMetadata("4", result, env.NEXT_PUBLIC_SUPABASE_URL);
    assert.equal(metadata.robots.index, false); assert.deepEqual(metadata.openGraph.images, []);
    assert.ok(!JSON.stringify(metadata).includes(product.title));
  }
});
test("missing configuration, invalid IDs and database errors fail without leaking credentials", async () => {
  assert.equal(await getPublicPreviewProduct("4", { env: {}, fetchImpl: () => { throw Error("must not fetch"); } }), null);
  assert.equal(await getPublicPreviewProduct("4&select=*", { env, fetchImpl: () => { throw Error("must not fetch"); } }), null);
  assert.equal(await getPublicPreviewProduct("4", { env, fetchImpl: async () => Response.json({ error: "private-key" }, { status: 403 }) }), null);
  assert.equal(await getPublicPreviewProduct("4", { env, fetchImpl: async () => { throw Error("private-key"); } }), null);
});
test("photo-less listings have a text preview; unsafe/private paths are not used", () => {
  for (const image_path of [null, "identity-documents/private.jpg", "../../private.jpg", "https://external.example/photo.jpg"]) {
    const result = productPreviewMetadata("4", { ...product, image_path }, env.NEXT_PUBLIC_SUPABASE_URL);
    assert.equal(result.title, "Alex Eala tennis card | PinoyBuyNSell");
    assert.deepEqual(result.openGraph.images, []); assert.equal(result.twitter.card, "summary");
  }
});
test("long formatted descriptions become a short readable preview", () => {
  const result = productPreviewMetadata("4", { ...product, description: "<b>New</b>\n\n card " + "details ".repeat(500) }, env.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(result.description.length, 240); assert.ok(!result.description.includes("<b>"));
  assert.ok(!result.description.includes("\n"));
});
