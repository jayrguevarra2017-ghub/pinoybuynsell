import HomePage from "@/components/HomePage";
import { getFeaturedListings } from "@/lib/public-listings.mjs";
import { homeSEO, publicPageMetadata, serializeJsonLd, siteStructuredData } from "@/lib/seo.mjs";

export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata(homeSEO);

export default async function Page() {
  let products = null;
  try { products = await getFeaturedListings({ env: process.env }); } catch { /* The browser can retry the public listings. */ }
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(siteStructuredData) }} /><HomePage initialProducts={products} /></>;
}
