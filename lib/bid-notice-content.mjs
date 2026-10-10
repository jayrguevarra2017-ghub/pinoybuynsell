export const recentBidLimit = 50;
export const bidReadPreference = "marketplace_bid_notice_read_ids";
export const validBidId = value => typeof value === "string" && /^[1-9]\d{0,18}$/.test(value);
export function bidReadIds(value) {
  return [...new Set(Array.isArray(value) ? value.filter(validBidId) : [])]
    .sort((a, b) => BigInt(a) > BigInt(b) ? -1 : 1).slice(0, 100);
}
export function mergeBidReadIds(previous, selected) { return bidReadIds([...bidReadIds(previous), ...selected]); }
export function validBidNotices(value, userId) {
  if (value?.userId !== userId || !Array.isArray(value.items) || value.items.length > recentBidLimit
    || typeof value.hasMore !== "boolean" || typeof value.hasListings !== "boolean") return false;
  const ids = new Set();
  return value.items.every(item => {
    if (!validBidId(item.id) || ids.has(item.id) || !validBidId(item.listingId) || typeof item.title !== "string"
      || !Number.isFinite(item.amount) || item.amount <= 0 || !Number.isFinite(Date.parse(item.createdAt)) || typeof item.read !== "boolean") return false;
    ids.add(item.id); return true;
  });
}
