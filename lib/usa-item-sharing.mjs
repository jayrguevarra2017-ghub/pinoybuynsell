import { usaItemId, usaStoreLink } from "./usa-items.mjs";
import { listingHashtags } from "./listing-hashtags.mjs";
import { siteUrl } from "./seo.mjs";

export const usaItemPath = id => usaItemId(id) ? `/usa-shopping/item/${id}` : null;
export const usaItemUrl = id => usaItemPath(id) ? `${siteUrl}${usaItemPath(id)}` : null;
export const usaItemShareUrl = id => usaItemUrl(id) ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(usaItemUrl(id))}` : null;
export const usaItemPublishingPath = id => usaItemId(id) ? `/admin/facebook/usa?item=${id}` : null;
// Distinct from product IDs; reuse the existing private publishing ledger.
export const usaFacebookJobId = id => usaItemId(id) ? `usa:${id}` : null;
export const usaQuotePath = id => usaItemId(id) ? `/usa-shopping?item=${id}#usa-quote` : "/usa-shopping#usa-quote";

export function canPublishUSAItem(item, user, admin) {
  return admin === true && Boolean(user?.id) && item?.admin_id === user.id && item.status === "published" && Boolean(usaItemUrl(item.id));
}

export function usaReferencePrice(item) {
  const price = Number(item?.usd_price);
  return item?.usd_price != null && Number.isFinite(price) && price >= 0
    ? price.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "";
}

export function usaItemHashtags(item) {
  // Reuse the marketplace's title-only allowlist. Infer only obvious categories
  // since USA cards have no category field; never inspect private quote data.
  const title = String(item?.title || "").slice(0, 200);
  const category = /\b(iphone|samsung|garmin|laptop|camera|dslr|mirrorless|smartwatch)\b/i.test(title) ? "Electronics"
    : /\b(nike|adidas|sneakers?|jersey)\b/i.test(title) ? "Fashion" : "";
  return [...new Set(["#PinoyBuyNSell", "#BuyAndSellPH", "#USAtoPhilippines", "#USAShopping",
    ...listingHashtags({ title, category })])].slice(0, 10);
}

export function usaItemCaption(item) {
  const source = usaStoreLink(item?.item_url);
  const lines = [String(item?.title || "USA find").trim().slice(0, 200), "USA to Philippines shopping assistance"];
  if (source) lines.push(`Source store: ${source.name}`);
  const price = usaReferencePrice(item);
  if (price) lines.push(`Reference store price: ${price} USD`);
  const description = typeof item?.description === "string" ? item.description.trim().slice(0, 1500) : "";
  if (description) lines.push("", description);
  lines.push("", "Request a delivered quote. Store prices and availability may change. Service fees, shipping and import charges are quoted separately.");
  if (usaItemUrl(item?.id)) lines.push("", usaItemUrl(item.id));
  const caption = lines.join("\n");
  const existing = new Set((caption.match(/#[\p{L}\p{N}_]+/gu) || []).map(tag => tag.toLowerCase()));
  const additional = usaItemHashtags(item).filter(tag => !existing.has(tag.toLowerCase()));
  return additional.length ? `${caption}\n\n${additional.join(" ")}` : caption;
}

export function usaItemMetadata(item, supabaseUrl) {
  const title = `${String(item.title).trim().slice(0, 180)} | USA Finds | PinoyBuyNSell`;
  const price = usaReferencePrice(item);
  const description = `${item.store}${price ? ` · Reference price ${price} USD` : ""}. Request a USA to Philippines delivered quote. Fees, shipping and import charges quoted separately. ${String(item.description).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}`.slice(0, 260);
  let images = [];
  if (typeof item.image_path === "string" && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(item.image_path)) {
    try {
      const base = new URL(supabaseUrl);
      if (base.protocol === "https:") images = [{ url: `${base.origin}/storage/v1/object/public/listing-photos/${item.image_path}`, alt: item.title }];
    } catch { /* Keep a text preview if image configuration is unavailable. */ }
  }
  const url = usaItemUrl(item.id);
  return { title, description, alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "PinoyBuyNSell", type: "website", locale: "en_PH", images },
    twitter: { card: images.length ? "summary_large_image" : "summary", title, description, images: images.map(image => image.url) } };
}
