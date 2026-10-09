import { publicListingFields, readPublicListings } from "./public-listings.mjs";
import { siteUrl } from "./seo.mjs";

export async function getPublicPreviewProduct(id, { env, fetchImpl = fetch }) {
  if (typeof id !== "string" || !/^[A-Za-z0-9-]{1,100}$/.test(id)) return null;
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  try {
    const query = {
      select: publicListingFields,
      id: `eq.${id}`, status: "eq.active", deleted_at: "is.null", limit: "1",
    };
    const products = await readPublicListings(query, { env, fetchImpl });
    const product = Array.isArray(products) ? products[0] : null;
    if (!product || String(product.id) !== id || product.status !== "active" || product.deleted_at) return null;
    return product;
  } catch { return null; }
}

export function productPreviewMetadata(id, product, supabaseUrl) {
  const canonical = `${siteUrl}/product/${encodeURIComponent(String(id))}`;
  if (!product || product.status !== "active" || product.deleted_at) return {
    title: "Listing unavailable | PinoyBuyNSell",
    description: "This listing is unavailable. Browse other items on PinoyBuyNSell.",
    robots: { index: false, follow: false },
    openGraph: { title: "Listing unavailable | PinoyBuyNSell", description: "This listing is unavailable.",
      url: canonical, type: "website", siteName: "PinoyBuyNSell", images: [] },
    twitter: { card: "summary", title: "Listing unavailable | PinoyBuyNSell", description: "This listing is unavailable.", images: [] },
  };
  const itemTitle = String(product.title || "Marketplace item").trim().slice(0, 180);
  const title = `${itemTitle} | PinoyBuyNSell`;
  const details = String(product.description || "View item details on PinoyBuyNSell.").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const price = Number(product.price);
  const priceText = product.price != null && Number.isFinite(price)
    ? `${price.toLocaleString("en-PH", { style: "currency", currency: "PHP" })} — ` : "";
  const description = `${priceText}${details}`.slice(0, 240);
  let images = [];
  // Only publish a path in the public listing-photo bucket; private IDs are never preview images.
  if (typeof product.image_path === "string" && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(product.image_path)) {
    try {
      const base = new URL(supabaseUrl);
      if (base.protocol === "https:") images = [{
        url: `${base.origin}/storage/v1/object/public/listing-photos/${product.image_path}`,
        alt: itemTitle,
      }];
    } catch { /* A text preview still works if the image configuration is unavailable. */ }
  }
  return { title, description, alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", siteName: "PinoyBuyNSell", locale: "en_PH", images },
    twitter: { card: images.length ? "summary_large_image" : "summary", title, description, images: images.map(image => image.url) },
  };
}
