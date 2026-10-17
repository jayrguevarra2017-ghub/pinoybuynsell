import { paymentMethodsSummary, returnsPolicySummary } from "./payment-rules.mjs";
import { appendListingHashtags } from "./listing-hashtags.mjs";

// Shared by the server publisher, caption updates and the manual copy action.
// Only explicitly selected public listing fields are included.
export function facebookCaption(product) {
  const money = value => Number(value).toLocaleString("en-PH", { style: "currency", currency: "PHP" });
  const link = `https://pinoybuynsell.com/product/${encodeURIComponent(String(product.id))}`;
  const caption = [String(product.title || "Marketplace listing").slice(0, 200),
    product.listing_type === "auction" ? `Auction · starting bid: ${money(product.auction_starting_price)}` : `Price: ${money(product.price)}`,
    product.listing_type === "fixed_price" && `Quantity available: ${product.quantity}`,
    product.variations?.length && `Variations: ${product.variations.map(v => `${v.name} (${v.quantity} available)`).join(", ")}`,
    product.listing_type === "auction" && Number.isFinite(Date.parse(product.auction_ends_at)) &&
      `Auction closes (Philippine time): ${new Date(product.auction_ends_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`,
    product.condition && `Condition: ${product.condition}`, product.location && `Location: ${product.location}`,
    product.shipping_carrier && product.shipping_fee != null && `Shipping: ${product.shipping_carrier} · ${money(product.shipping_fee)}`,
    String(product.description || "").slice(0, 1500), `Payment: ${paymentMethodsSummary} ${returnsPolicySummary} See the listing for full payment and return rules.`,
    `View item details and auction information: ${link}`].filter(Boolean).join("\n\n");
  return appendListingHashtags(caption, product);
}
