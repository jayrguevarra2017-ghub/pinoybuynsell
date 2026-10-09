export const facebookPageUrl = "https://www.facebook.com/pinoybuynsellph/";
export const messengerUrl = "https://m.me/pinoybuynsellph";

export function listingUrl(id) {
  return `https://pinoybuynsell.com/product/${encodeURIComponent(String(id))}`;
}

export function listingShareUrl(id) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(listingUrl(id))}`;
}
