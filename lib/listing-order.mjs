export function latestListingAuction(product) {
  const auctions = Array.isArray(product.auctions) ? product.auctions : product.auctions ? [product.auctions] : [];
  return [...auctions].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)
    || String(b.id || "").localeCompare(String(a.id || ""), undefined, { numeric: true }))[0] || null;
}

export function listingAvailability(product, now = Date.now()) {
  if (!["active", "sold"].includes(product.status) || product.deleted_at) return { rank: 3, label: "Unavailable", state: "unavailable" };
  if (product.status === "sold") return { rank: 2, label: "Sold", state: "sold" };
  if (product.listing_type !== "auction") return Number(product.quantity ?? 1) > 0
    ? { rank: 0, label: "Available", state: "available" } : { rank: 2, label: "Out of stock", state: "out-of-stock" };
  const auction = latestListingAuction(product), end = Date.parse(auction?.ends_at ?? product.auction_ends_at);
  const start = auction?.starts_at ? Date.parse(auction.starts_at) : null;
  if (!Number.isFinite(end) || (start !== null && (!Number.isFinite(start) || start >= end)))
    return { rank: 2, label: "Check auction details", state: "unavailable" };
  if ((auction && auction.status !== "active") || end <= now) return { rank: 2, label: "Bidding ended", state: "ended", end };
  if (start !== null && start > now) return { rank: 1, label: "Upcoming auction", state: "scheduled", end, start };
  return { rank: 0, label: "Live auction", state: "active", end };
}

export function sortMarketplaceListings(products, now = Date.now()) {
  return [...products].sort((a, b) => {
    const aa = listingAvailability(a, now), bb = listingAvailability(b, now);
    // Live auctions have a deadline; available fixed-price items follow them.
    // Closed items are newest first, with IDs making all ties deterministic.
    return aa.rank - bb.rank || (aa.rank < 2 ? (aa.end ?? Infinity) - (bb.end ?? Infinity) : 0)
      || (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)
      || String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
  });
}

export function auctionCardFromProduct(product) {
  const auction = latestListingAuction(product);
  return {
    id: auction?.id ?? `listing-${product.id}`, productId: product.id, title: product.title,
    imagePath: product.image_path, location: product.location,
    currentBid: auction?.current_bid ?? auction?.starting_price ?? product.auction_starting_price,
    startTime: auction?.starts_at, status: product.status === "sold" ? "sold" : auction?.status ?? "active",
    endTime: auction?.ends_at ?? product.auction_ends_at, productStatus: product.status,
    created_at: product.created_at, icon: "🏷️"
  };
}

function auctionCardProduct(card) {
  return {
    id: card.productId, listing_type: "auction", status: card.productStatus ?? (card.status === "sold" ? "sold" : "active"),
    created_at: card.created_at,
    auctions: { id: card.id, status: card.status ?? "active", starts_at: card.startTime, ends_at: card.endTime }, card
  };
}

export function auctionCardAvailability(card, now = Date.now()) { return listingAvailability(auctionCardProduct(card), now); }

export function sortAuctionCards(cards, now = Date.now()) {
  return sortMarketplaceListings(cards.map(auctionCardProduct), now).map(p => p.card);
}
