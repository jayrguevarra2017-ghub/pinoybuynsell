import { getSitemapListings } from "@/lib/public-listings.mjs";
import { siteUrl } from "@/lib/seo.mjs";

export const dynamic = "force-dynamic";

export default async function sitemap() {
  const listings = await getSitemapListings({ env: process.env });
  return ["/", "/search", "/auctions", "/usa-shopping", "/prohibited-items"].map(path => ({ url: `${siteUrl}${path}` })).concat(
    listings.filter(p => /^[A-Za-z0-9-]{1,100}$/.test(String(p.id))).map(p => ({ url: `${siteUrl}/product/${encodeURIComponent(String(p.id))}` }))
  );
}
