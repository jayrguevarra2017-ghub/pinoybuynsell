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
    assert.equal(query.get("offset"), "0"); assert.equal(query.get("limit"), "1000");
    assert.equal(query.get("category"), 'eq."Home & Living"');
    assert.equal(query.get("or"), '(title.ilike."*card\\",status.eq.draft*",description.ilike."*card\\",status.eq.draft*")');
    assert.ok(!query.get("select").includes("seller_id"));
    return Response.json([]);
  } });
});

test("auction discovery keeps one latest auction per listing, ending soonest first and closed last", async () => {
  const now = Date.parse("2026-10-09T00:00:00Z");
  const image_path = "00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000002.jpg";
  const rows = [
    { ...item, id: 1, listing_type: "auction", image_path, auctions: [
      { id: "historical", status: "active", ends_at: "2026-10-09T01:00:00Z", created_at: "2026-10-01" },
      { id: "late", status: "active", ends_at: "2026-10-11T00:00:00Z", current_bid: 200, created_at: "2026-10-08" }
    ] },
    { ...item, id: 2, listing_type: "auction", image_path, auctions: { id: "closed", status: "ended", ends_at: "2026-10-11T00:00:00Z" } },
    { ...item, id: 3, listing_type: "auction", image_path, auctions: { id: "expired", status: "active", ends_at: "2026-10-08T00:00:00Z" } },
    { ...item, id: 4, listing_type: "auction", image_path, auctions: { id: "soon", status: "active", ends_at: "2026-10-10T00:00:00Z", starting_price: 100 } },
    { ...item, id: 5, status: "sold", listing_type: "auction", image_path, auctions: { id: "sold", status: "active", ends_at: "2026-10-09T01:00:00Z" } }
  ];
  const auctions = await getPublicAuctionCards({ env, fetchImpl: async url => {
    const params = new URL(url).searchParams;
    assert.equal(params.get("status"), "in.(active,sold)");
    if (params.has("offset")) { assert.equal(params.get("listing_type"), "eq.auction"); assert(!params.get("select").includes("image_path")); }
    else assert(params.get("select").includes("image_path"));
    return Response.json(rows);
  } }, now);
  assert.deepEqual(auctions.map(a => a.id), ["soon", "late", "sold", "expired", "closed"]);
  assert.equal(auctions[0].currentBid, 100);
  assert.equal(auctions[2].status, "sold");
  assert(auctions.every(a => a.imagePath === image_path));
});

test("structured data states real PHP offers, stock and condition without fictional ratings", () => {
  const data = productStructuredData("1", item, productPreviewMetadata("1", item, env.NEXT_PUBLIC_SUPABASE_URL));
  assert.equal(data["@type"], "Product");
  assert.equal(data.offers.priceCurrency, "PHP"); assert.equal(data.offers.price, "500.00");
  assert.equal(data.offers.availability, "https://schema.org/InStock"); assert.equal(data.itemCondition, "https://schema.org/NewCondition");
  assert.ok(!data.aggregateRating); assert.ok(!data.review);
  const zero = { ...item, quantity: 0 };
  assert.equal(productStructuredData("1", zero, productPreviewMetadata("1", zero, env.NEXT_PUBLIC_SUPABASE_URL)).offers.availability, "https://schema.org/OutOfStock");
});

test("auctions and listings without purchase prices use page metadata without invalid Product snippets", () => {
  for (const product of [{ ...item, listing_type: "auction" }, { ...item, listing_type: undefined },
    { ...item, price: null }, { ...item, price: 0 }, { ...item, price: -5 }, { ...item, price: "invalid" }]) {
    const data = productStructuredData("1", product, productPreviewMetadata("1", product, env.NEXT_PUBLIC_SUPABASE_URL));
    assert.equal(data["@type"], "WebPage");
    assert.equal(data.name, item.title);
    assert.equal(data.url, "https://pinoybuynsell.com/product/1");
    assert.ok(!data.offers); assert.ok(!data.review); assert.ok(!data.aggregateRating);
    assert.ok(!JSON.stringify(data).includes('"@type":"Product"'));
  }
});

test("auction page metadata preserves public photos and private listings have no structured data", () => {
  const auction = { ...item, listing_type: "auction", image_path: "00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000002.jpg" };
  const metadata = productPreviewMetadata("1", auction, env.NEXT_PUBLIC_SUPABASE_URL);
  const data = productStructuredData("1", auction, metadata);
  assert.equal(data.primaryImageOfPage.contentUrl, metadata.openGraph.images[0].url);
  assert.equal(data.primaryImageOfPage.caption, item.title);
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
