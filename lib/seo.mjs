export const siteUrl = "https://pinoybuynsell.com";

export function publicPageMetadata({ title, description, path = "/" }) {
  const url = `${siteUrl}${path}`;
  return {
    title, description, alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "PinoyBuyNSell", type: "website", locale: "en_PH",
      images: [{ url: "/branding/pinoybuynsell-facebook-profile.png", alt: "PinoyBuyNSell marketplace logo" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/branding/pinoybuynsell-facebook-profile.png"] },
  };
}

export const privatePageMetadata = { robots: { index: false, follow: false }, openGraph: { images: [] }, twitter: { images: [] } };

// Listing text is user supplied; escape script-breaking characters in structured data.
export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export const siteStructuredData = { "@context": "https://schema.org", "@graph": [
  { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "PinoyBuyNSell", url: siteUrl,
    logo: `${siteUrl}/branding/pinoybuynsell-facebook-profile.png`, sameAs: ["https://www.facebook.com/pinoybuynsellph/"] },
  { "@type": "WebSite", "@id": `${siteUrl}/#website`, name: "PinoyBuyNSell", url: siteUrl,
    publisher: { "@id": `${siteUrl}/#organization` }, inLanguage: "en-PH" },
] };

export function productStructuredData(id, product, metadata) {
  if (!product || product.status !== "active" || product.deleted_at) return null;
  const data = { "@context": "https://schema.org", "@type": "Product", name: String(product.title || "Marketplace item"),
    description: String(product.description || "View item details on PinoyBuyNSell.").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    url: `${siteUrl}/product/${encodeURIComponent(String(id))}`,
    ...(metadata.openGraph.images.length ? { image: metadata.openGraph.images.map(image => image.url) } : {}),
    ...(product.category ? { category: product.category } : {}),
  };
  const condition = String(product.condition || "").toLowerCase();
  if (["new", "brand new"].includes(condition)) data.itemCondition = "https://schema.org/NewCondition";
  else if (["used", "like new", "good condition"].includes(condition)) data.itemCondition = "https://schema.org/UsedCondition";
  // An auction's displayed item value is not an offer price. Never describe it as one.
  if (product.listing_type === "fixed_price" && product.price != null && Number.isFinite(Number(product.price)) && Number(product.price) > 0) {
    data.offers = { "@type": "Offer", url: data.url, priceCurrency: "PHP", price: Number(product.price).toFixed(2),
      availability: Number(product.quantity ?? 1) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" };
  }
  return data;
}
