import HomePage from "@/components/HomePage";
import { getFeaturedListings } from "@/lib/public-listings.mjs";
import { publicPageMetadata, serializeJsonLd, siteStructuredData } from "@/lib/seo.mjs";

export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata({
  title: "PinoyBuyNSell | Buy, Sell & Bid in the Philippines",
  description: "Browse new and pre-owned items, sell your goods, and bid in online auctions across the Philippines. Request USA shopping and delivery assistance with PinoyBuyNSell.",
});

export default async function Page() {
  let products = null;
  try { products = await getFeaturedListings({ env: process.env }); } catch { /* The browser can retry the public listings. */ }
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(siteStructuredData) }} /><HomePage initialProducts={products} /></>;
}
