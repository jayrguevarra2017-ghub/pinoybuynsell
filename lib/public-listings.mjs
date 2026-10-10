import { missingGalleryColumn } from "./listing-gallery.mjs";
import { sortMarketplaceListings, auctionCardFromProduct } from "./listing-order.mjs";

// Server-side reads use only anonymous credentials and public listing fields.
export const publicListingFields = "id,title,description,price,image_path,image_paths,status,deleted_at,category,condition,location,shipping_carrier,shipping_fee,listing_type,quantity,variations,auction_starting_price,auction_ends_at,created_at";

async function readListings(query, { env, fetchImpl = fetch }, includeClosed = false) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw Error("Public listings unavailable");
  const params = new URLSearchParams({ ...query, status: includeClosed ? "in.(active,sold)" : "eq.active", deleted_at: "is.null" });
  const request = () => fetchImpl(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/rest/v1/products?${params}`, {
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
    cache: "no-store", signal: AbortSignal.timeout(8000), redirect: "error",
  });
  let response = await request();
  // Keep existing deployments readable while the additive gallery migration is pending.
  if (!response.ok && params.get("select")?.includes("image_paths") && missingGalleryColumn(await response.clone().json().catch(() => null))) {
    params.set("select", params.get("select").replace(",image_paths", ""));
    response = await request();
  }
  if (!response.ok) throw Error("Public listings unavailable");
  const data = await response.json();
  if (!Array.isArray(data)) throw Error("Public listings unavailable");
  return data.filter(p => p && (p.status === "active" || (includeClosed && p.status === "sold")) && !p.deleted_at);
}

// SEO previews and sitemap discovery intentionally remain active-only.
export function readPublicListings(query, options) { return readListings(query, options); }

const literal = value => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const auctionFields = "auctions(id,starts_at,ends_at,status,created_at,starting_price,current_bid)";

// Choose a page from the complete lightweight public index, so newer closed
// items cannot displace older available items onto a later page. Fetch heavy
// detail/photo payloads only for the selected IDs. No schema change required.
async function orderedListings(filters, options, offset, limit, now = Date.now()) {
  const params = {
    select: `id,status,deleted_at,listing_type,quantity,auction_ends_at,created_at,${auctionFields}`,
    order: "id.asc"
  };
  if (filters.category) params.category = `eq.${literal(filters.category)}`;
  if (filters.query) {
    const phrase = literal(`*${filters.query.replace(/[%*]/g, "")}*`);
    params.or = `(title.ilike.${phrase},description.ilike.${phrase})`;
  }
  if (filters.sellerId) params.seller_id = `eq.${literal(filters.sellerId)}`;
  if (filters.auctions) params.listing_type = "eq.auction";
  const index = [], seen = new Set();
  for (let start = 0; start < 10000; start += 1000) {
    const rows = await readListings({ ...params, limit: "1000", offset: String(start) }, options, true);
    for (const row of rows) {
      const id = String(row.id);
      if (!/^[1-9]\d*$/.test(id) || seen.has(id)) throw Error("Public listing index changed; refresh to try again");
      seen.add(id); index.push(row);
    }
    if (rows.length < 1000) break;
    if (start === 9000) throw Error("Public listing index requires database pagination");
  }
  const selected = sortMarketplaceListings(index, now).slice(offset, offset + limit);
  if (!selected.length) return [];
  const rows = await readListings({ ...params, select: `${publicListingFields},${auctionFields}`,
    id: `in.(${selected.map(p => p.id).join(",")})`, limit: String(limit) }, options, true);
  const order = new Map(selected.map((p, i) => [String(p.id), i]));
  return rows.filter(p => order.has(String(p.id))).sort((a, b) => order.get(String(a.id)) - order.get(String(b.id)));
}

export function getFeaturedListings(options) { return orderedListings({}, options, 0, 12); }

export function getBrowseListings({ category = "", query = "", page = 1, sellerId = "" }, options) {
  return orderedListings({ category, query, sellerId }, options, (page - 1) * 24, 25);
}

export async function getPublicAuctionCards(options, now = Date.now(), page = 1) {
  return (await orderedListings({ auctions: true }, options, (page - 1) * 24, 25, now)).map(auctionCardFromProduct);
}

// Supabase limits responses to a page. Fetch each page so older listings are discoverable too.
export async function getSitemapListings(options, pageSize = 1000, maxListings = 45000) {
  const listings = [];
  for (let offset = 0; offset < maxListings; offset += pageSize) {
    const page = await readPublicListings({ select: "id,status,deleted_at", order: "id.asc", limit: String(pageSize), offset: String(offset) }, options);
    listings.push(...page);
    if (page.length < pageSize) return listings;
  }
  // Don't silently publish a truncated or empty sitemap on a database failure/size limit.
  throw Error("Listing sitemap requires splitting into multiple files");
}
