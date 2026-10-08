export const facebookPageUrl = "https://www.facebook.com/pinoybuynsellph/";
export const messengerUrl = "https://m.me/pinoybuynsellph";

export function listingShareUrl(id) {
  const url = `https://pinoybuynsell.com/product/${encodeURIComponent(String(id))}`;
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}
