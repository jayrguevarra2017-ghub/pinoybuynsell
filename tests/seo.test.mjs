import test from "node:test";
import assert from "node:assert/strict";
import { readPublicListings, getSitemapListings, getBrowseListings, getPublicAuctionCards } from "../lib/public-listings.mjs";
import { productStructuredData, serializeJsonLd, privatePageMetadata, publicPageMetadata } from "../lib/seo.mjs";
import { productPreviewMetadata } from "../lib/product-metadata.mjs";

const env = { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key", SUPABASE_SERVICE_ROLE_KEY: "private-key" };
const item = { id: "1", title: "Collectible card", description: "A new card", price: 500, status: "active", deleted_at: null, listing_type: "fixed_price", quantity: 1, condition: "Brand New" };

test("public list reads cannot bypass active/deleted filters or use private credentials", async () => {
  const result = await readPublicListings({ select: "id,status,deleted_at", status: "eq.draft", deleted_at: "not.is.null" }, { env, fetchImpl: async (url, options) => {
    const query = new URL(url).searchParams;
    assert.equal(query.get("status"), "eq.active"); assert.equal(query.get("deleted_at"), "is.null");
    assert.equal(options.headers.Authorization, "Bearer public-key"); assert.equal(options.cache, "no-store");
    return Response.json([item, { ...item, status: "draft" }, { ...item, deleted_at: "2026-10-09" }]);
  } });
  assert.deepEqual(result, [item]);
});

test("sitemap pagination includes listings beyond Supabase's first page", async () => {
  const offsets = [];
  const result = await getSitemapListings({ env, fetchImpl: async url => {
    const query = new URL(url).searchParams;
    assert.equal(query.get("select"), "id,status,deleted_at");
    const offset = Number(query.get("offset")); offsets.push(offset);
    return Response.json(offset === 0 ? [item, { ...item, id: "2" }] : [{ ...item, id: "3" }]);
  } }, 2, 10);
  assert.deepEqual(result.map(p => p.id), ["1", "2", "3"]); assert.deepEqual(offsets, [0, 2]);
});

test("sitemap errors and size limits cannot silently return empty or truncated data", async () => {
  await assert.rejects(getSitemapListings({ env, fetchImpl: async () => Response.json({}, { status: 503 }) }), /Public listings unavailable/);
  await assert.rejects(getSitemapListings({ env, fetchImpl: async () => Response.json([item]) }, 1, 2), /splitting/);
  await assert.rejects(readPublicListings({}, { env: {} }), /unavailable/);
});

test("browse filters quote delimiters and paginate real public listings", async () => {
  await getBrowseListings({ query: 'card",status.eq.draft', category: 'Home & Living', page: 2 }, { env, fetchImpl: async url => {
    const query = new URL(url).searchParams;
    assert.equal(query.get("offset"), "24"); assert.equal(query.get("limit"), "25");
    assert.equal(query.get("category"), 'eq."Home & Living"');
    assert.equal(query.get("or"), '(title.ilike."*card\\",status.eq.draft*",description.ilike."*card\\",status.eq.draft*")');
    assert.ok(!query.get("select").includes("seller_id"));
    return Response.json([]);
  } });
});

test("auction discovery excludes ended auctions and orders by closing time", async () => {
  const now = Date.parse("2026-10-09T00:00:00Z");
  const auctions = await getPublicAuctionCards({ env, fetchImpl: async () => Response.json([{ ...item, auctions: [
    { id: "late", status: "active", ends_at: "2026-10-11T00:00:00Z", current_bid: 200 },
    { id: "closed", status: "ended", ends_at: "2026-10-11T00:00:00Z" },
    { id: "expired", status: "active", ends_at: "2026-10-08T00:00:00Z" },
    { id: "soon", status: "active", ends_at: "2026-10-10T00:00:00Z", starting_price: 100 },
  ] }]) }, now);
  assert.deepEqual(auctions.map(a => a.id), ["soon", "late"]); assert.equal(auctions[0].currentBid, 100);
  const one = await getPublicAuctionCards({ env, fetchImpl: async () => Response.json([{ ...item,
    auctions: { id: "single", status: "active", ends_at: "2026-10-10T00:00:00Z", starting_price: 100 } }]) }, now);
  assert.equal(one[0].id, "single");
});

test("structured data states real PHP offers, stock and condition without fictional ratings", () => {
  const data = productStructuredData("1", item, productPreviewMetadata("1", item, env.NEXT_PUBLIC_SUPABASE_URL));
  assert.equal(data.offers.priceCurrency, "PHP"); assert.equal(data.offers.price, "500.00");
  assert.equal(data.offers.availability, "https://schema.org/InStock"); assert.equal(data.itemCondition, "https://schema.org/NewCondition");
  assert.ok(!data.aggregateRating); assert.ok(!data.review);
  const zero = { ...item, quantity: 0 };
  assert.equal(productStructuredData("1", zero, productPreviewMetadata("1", zero, env.NEXT_PUBLIC_SUPABASE_URL)).offers.availability, "https://schema.org/OutOfStock");
});

test("auction values cannot become offer prices and private listings have no structured data", () => {
  const auction = { ...item, listing_type: "auction" };
  assert.ok(!productStructuredData("1", auction, productPreviewMetadata("1", auction, env.NEXT_PUBLIC_SUPABASE_URL)).offers);
  assert.equal(productStructuredData("1", { ...item, status: "draft" }, {}), null);
  assert.equal(productStructuredData("1", { ...item, deleted_at: "2026-10-09" }, {}), null);
});

test("user supplied JSON-LD cannot close its script tag or create another script", () => {
  const attack = { ...item, title: '</script><script>alert("x")</script> & \u2028' };
  const json = serializeJsonLd(attack);
  assert.ok(!json.includes("<")); assert.ok(!json.includes("&")); assert.ok(!json.includes("\u2028"));
  assert.deepEqual(JSON.parse(json), attack);
});

test("public pages have their own canonical while private routes are excluded", () => {
  const page = publicPageMetadata({ path: "/usa-shopping", title: "USA shopping", description: "Request a quote" });
  assert.equal(page.alternates.canonical, "https://pinoybuynsell.com/usa-shopping");
  assert.equal(page.openGraph.url, page.alternates.canonical);
  assert.deepEqual(privatePageMetadata.robots, { index: false, follow: false });
});
