// Server-side reads use only anonymous credentials and public listing fields.
export const publicListingFields = "id,title,description,price,image_path,status,deleted_at,category,condition,location,shipping_carrier,shipping_fee,listing_type,quantity,variations,auction_starting_price,auction_ends_at,created_at";

export async function readPublicListings(query, { env, fetchImpl = fetch }) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw Error("Public listings unavailable");
  const params = new URLSearchParams({ ...query, status: "eq.active", deleted_at: "is.null" });
  const response = await fetchImpl(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/rest/v1/products?${params}`, {
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
    cache: "no-store", signal: AbortSignal.timeout(8000), redirect: "error",
  });
  if (!response.ok) throw Error("Public listings unavailable");
  const data = await response.json();
  if (!Array.isArray(data)) throw Error("Public listings unavailable");
  return data.filter(p => p && p.status === "active" && !p.deleted_at);
}

export function getFeaturedListings(options) {
  return readPublicListings({ select: `${publicListingFields},auctions(starts_at,ends_at,status,created_at)`, order: "created_at.desc,id.desc", limit: "12" }, options);
}

export function getBrowseListings({ category = "", query = "", page = 1 }, options) {
  // Quote PostgREST filter values; user input cannot add filter expressions.
  const literal = value => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const params = { select: `${publicListingFields},auctions(starts_at,ends_at,status,created_at)`, order: "created_at.desc,id.desc", limit: "25", offset: String((page - 1) * 24) };
  if (category) params.category = `eq.${literal(category)}`;
  if (query) {
    const phrase = literal(`*${query.replace(/[%*]/g, "")}*`);
    params.or = `(title.ilike.${phrase},description.ilike.${phrase})`;
  }
  return readPublicListings(params, options);
}

export async function getPublicAuctionCards(options, now = Date.now()) {
  const products = await readPublicListings({ select: "id,title,location,status,deleted_at,auctions!inner(id,starting_price,current_bid,starts_at,ends_at,status)",
    "auctions.status": "eq.active", "auctions.ends_at": `gt.${new Date(now).toISOString()}`, order: "created_at.desc,id.desc", limit: "100" }, options);
  return products.flatMap(product => (Array.isArray(product.auctions) ? product.auctions : product.auctions ? [product.auctions] : []).filter(a => a.status === "active" && Date.parse(a.ends_at) > now)
    .map(a => ({ id: a.id, productId: product.id, title: product.title, location: product.location,
      currentBid: a.current_bid ?? a.starting_price, startTime: a.starts_at, status: a.status, endTime: a.ends_at, icon: "🏷️" })))
    .sort((a, b) => Date.parse(a.endTime) - Date.parse(b.endTime));
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
