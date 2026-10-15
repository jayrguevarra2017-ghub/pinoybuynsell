export const usaItemFields = "id,admin_id,title,item_url,store,description,image_path,usd_price,status,created_at,updated_at";
export const usaStores = [
  { name: "Amazon", domain: "amazon.com", href: "https://www.amazon.com/" },
  { name: "eBay", domain: "ebay.com", href: "https://www.ebay.com/" },
  { name: "Walmart", domain: "walmart.com", href: "https://www.walmart.com/" },
  { name: "Target", domain: "target.com", href: "https://www.target.com/" },
  { name: "Best Buy", domain: "bestbuy.com", href: "https://www.bestbuy.com/" },
  { name: "Nike", domain: "nike.com", href: "https://www.nike.com/" },
  { name: "B&H Photo", domain: "bhphotovideo.com", href: "https://www.bhphotovideo.com/" },
];
export const usaItemId = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function usaSignInReturn(value) {
  if (typeof value !== "string") return null;
  const match = /^\/usa-shopping(?:\?item=([0-9a-f-]{36}))?(?:#usa-quote)?$/.exec(value);
  return match && (!match[1] || usaItemId(match[1])) ? value : null;
}

export function usaStoreLink(value) {
  if (typeof value !== "string" || value.trim().length > 2000 || /[\u0000-\u0020\u007f\\]/.test(value.trim())) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const store = usaStores.find(s => url.hostname === s.domain || url.hostname.endsWith(`.${s.domain}`));
    if (!store) return null;
    return { name: store.name, href: url.href };
  } catch { return null; }
}

export function usaItemValues(form, imagePath) {
  const title = String(form.title || "").trim(), description = String(form.description || "").trim();
  const link = usaStoreLink(form.item_url), status = form.status;
  if (title.length < 3 || title.length > 200) throw Error("Enter an item title between 3 and 200 characters.");
  if (!link) throw Error(`Enter a full HTTPS item link from a supported store: ${usaStores.map(store => store.name).join(", ")}.`);
  if (description.length < 10 || description.length > 1500) throw Error("Add a description between 10 and 1,500 characters.");
  if (!["draft", "published", "archived"].includes(status)) throw Error("Choose a valid visibility setting.");
  if (imagePath != null && !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(imagePath)) throw Error("Choose a valid item photo.");
  if (status === "published" && !imagePath) throw Error("Add a photo before publishing, or save this item as a draft.");
  const raw = String(form.usd_price ?? "").trim();
  if (raw && (!/^\d{1,9}(\.\d{1,2})?$/.test(raw) || Number(raw) > 999999999)) throw Error("Enter a valid USD reference price with up to two decimal places, or leave it blank.");
  return { title, description, item_url: link.href, usd_price: raw ? Number(raw) : null, image_path: imagePath || null, status };
}

export function usaQuoteSelection(item) {
  if (!item || item.status !== "published" || !usaItemId(item.id) || !usaStoreLink(item.item_url)) return null;
  return { item_name: item.title, item_url: item.item_url, item_details: `${item.description}\n\nPlease confirm the size, color or model, current store availability and full delivered quote.` };
}
