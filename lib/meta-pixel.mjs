import { validMetaPixelId } from "./meta-pixel-config.mjs";

export const metaConsentKey = "pinoybuynsell-ad-consent-v1";
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const productId = value => /^[1-9][0-9]{0,18}$/.test(String(value));
const adParameters = new Set(["fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id"]);
const publicAnchors = new Set(["", "#browse", "#categories", "#auctions", "#usa-quote", "#usa-finds"]);

// The Meta library reads the current URL: exclude private routes and arbitrary
// query strings instead of forwarding authentication or customer information.
export function metaPageKind(href) {
  let url;
  try { url = new URL(href); } catch { return null; }
  if (!/^https?:$/.test(url.protocol) || !publicAnchors.has(url.hash) || url.username || url.password) return null;
  const path = url.pathname;
  if (path === "/account/orders") return url.search || url.hash ? null : "purchase";
  const publicPath = ["/", "/collectibles", "/auctions", "/usa-shopping"].includes(path)
    || /^\/product\/[1-9][0-9]{0,18}$/.test(path)
    || (path.startsWith("/usa-shopping/item/") && uuid(path.slice(19)));
  if (!publicPath || url.search.length > 2048) return null;
  for (const [key, value] of url.searchParams) {
    if (path === "/usa-shopping" && key === "item" && uuid(value)) continue;
    if (!adParameters.has(key) || value.length > 512 || /@|access_token|refresh_token|password|eyJ[A-Za-z0-9_-]+\./i.test(value)) return null;
  }
  return "public";
}

export function readMetaConsent(storage) {
  try {
    const saved = JSON.parse(storage.getItem(metaConsentKey));
    if (["allow", "deny"].includes(saved?.choice) && Number.isFinite(saved.since) && saved.since > 0) return saved;
  } catch { /* Missing or blocked storage requires a fresh choice. */ }
  return null;
}

export function metaReferrerSafe(value) {
  if (!value) return true;
  try { const url = new URL(value); return !url.username && !url.password && (!url.search || metaPageKind(value) === "public"); }
  catch { return false; }
}

export function metaItemData(item, usa = false) {
  if (!item || (usa ? !uuid(item.id) || item.status !== "published"
    : !productId(item.id) || item.status !== "active" || item.deleted_at || item.relisted_to_id != null)) return null;
  const data = { content_ids: [usa ? `usa:${item.id}` : String(item.id)], content_type: "product" };
  if (!usa && item.listing_type === "fixed_price" && Number.isFinite(Number(item.price)) && Number(item.price) > 0) {
    data.value = Number(item.price); data.currency = "PHP";
  }
  return data;
}

export function metaPurchaseData(order, { userId, consentSince, activatedAt, now = Date.now() }) {
  const paidAt = Date.parse(order?.paid_at), activation = Date.parse(activatedAt);
  if (!uuid(userId) || order?.buyer_id !== userId || !uuid(order?.id) || order.status !== "paid"
    || !Number.isFinite(paidAt) || !Number.isFinite(activation) || !Number.isFinite(consentSince) || consentSince <= 0
    || paidAt < Math.max(activation, consentSince) || paidAt > now + 300000 || now - paidAt > 72 * 3600000
    || !productId(order.product_id) || !Number.isInteger(order.quantity) || order.quantity < 1
    || !Number.isFinite(Number(order.total)) || Number(order.total) <= 0
    || !Number.isFinite(Number(order.unit_price)) || Number(order.unit_price) <= 0) return null;
  return { eventID: `purchase:${order.id}`, data: { value: Number(order.total), currency: "PHP",
    content_type: "product", content_ids: [String(order.product_id)], num_items: order.quantity,
    contents: [{ id: String(order.product_id), quantity: order.quantity, item_price: Number(order.unit_price) }] } };
}

// Browser-only transport. No Page access token or advanced-matching data.
export function createMetaPixel({ pixelId, browser, document, enabled, onReady = () => {} }) {
  let ready = false, started = false, lastPage = "", views = new Set();
  const purchases = new Set();
  const permitted = () => validMetaPixelId(pixelId) && enabled() && metaReferrerSafe(document.referrer) && metaPageKind(browser.location.href);
  const invoke = (...args) => { try { browser.fbq(...args); return true; } catch { return false; } };
  const consent = value => {
    const fbq = browser.fbq;
    if (!fbq) return;
    if (value === "revoke" && Array.isArray(fbq.queue)) {
      fbq.queue = fbq.queue.filter(args => args[0] !== "trackSingle" && !(args[0] === "consent" && args[1] === "grant"));
      if (!fbq.callMethod) { fbq.queue.unshift(["consent", "revoke"]); return; }
    }
    invoke("consent", value);
  };
  function start() {
    if (!permitted()) { consent("revoke"); return false; }
    if (started) { consent("grant"); return ready; }
    started = true;
    if (!browser.fbq) {
      const fbq = function() { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
      fbq.queue = []; fbq.push = fbq; fbq.loaded = true; fbq.version = "2.0";
      browser.fbq = fbq; browser._fbq ||= fbq;
    }
    if (!invoke("set", "autoConfig", false, pixelId)) return false;
    consent("grant"); if (!invoke("init", pixelId)) return false;
    if (browser.fbq.callMethod) { ready = true; onReady(); return true; }
    const script = document.createElement("script");
    script.async = true; script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset.pinoyMetaPixel = pixelId;
    script.onload = () => { ready = true; if (!permitted()) consent("revoke"); onReady(); };
    script.onerror = () => { ready = false; onReady(); };
    try { document.head.appendChild(script); } catch { ready = false; onReady(); }
    return false;
  }
  function pageView() {
    const kind = permitted();
    if (!kind || !start()) return false;
    const path = browser.location.pathname;
    if (lastPage !== path) { lastPage = path; views = new Set(); }
    if (kind !== "public" || views.has("page")) return false;
    if (!invoke("trackSingle", pixelId, "PageView")) return false;
    views.add("page"); return true;
  }
  return {
    sync() {
      const kind = permitted();
      if (kind === "public") { start(); pageView(); }
      else if (kind === "purchase") { if (started) consent("grant"); }
      else { consent("revoke"); lastPage = ""; views = new Set(); }
    },
    revoke() { consent("revoke"); lastPage = ""; views = new Set(); },
    item(item, usa = false) {
      const data = metaItemData(item, usa);
      if (!data || permitted() !== "public" || !start()) return false;
      if (browser.location.pathname !== (usa ? `/usa-shopping/item/${item.id}` : `/product/${item.id}`)) return false;
      pageView(); const key = `item:${data.content_ids[0]}`;
      if (views.has(key)) return false;
      if (!invoke("trackSingle", pixelId, "ViewContent", data)) return false;
      views.add(key); return true;
    },
    purchase(event) {
      if (!event || permitted() !== "purchase") return false;
      const key = `pinoy-meta:${pixelId}:${event.eventID}`;
      if (purchases.has(key)) return false;
      try { if (browser.localStorage.getItem(key)) return false; } catch { /* Memory deduplication still works. */ }
      if (!start()) return false;
      if (!invoke("trackSingle", pixelId, "Purchase", event.data, { eventID: event.eventID })) return false;
      purchases.add(key);
      try { browser.localStorage.setItem(key, "1"); } catch { /* Advertising storage cannot block a paid order. */ }
      return true;
    },
  };
}
