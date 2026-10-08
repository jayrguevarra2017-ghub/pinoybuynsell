const siteUrl = "https://pinoybuynsell.com";

export async function getPublicPreviewProduct(id, { env, fetchImpl = fetch }) {
  if (typeof id !== "string" || !/^[A-Za-z0-9-]{1,100}$/.test(id)) return null;
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  try {
    const query = new URLSearchParams({
      select: "id,title,description,price,image_path,status,deleted_at",
      id: `eq.${id}`, status: "eq.active", deleted_at: "is.null", limit: "1",
    });
    // Use anonymous access and public listing fields only. Never bypass RLS for a preview.
    const response = await fetchImpl(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/rest/v1/products?${query}`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
      cache: "no-store", signal: AbortSignal.timeout(8000), redirect: "error",
    });
    if (!response.ok) return null;
    const products = await response.json();
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
