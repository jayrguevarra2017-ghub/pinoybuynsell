// Owner-requested display count; this does not create or modify follower records.
const pinoySellerId = "29ee4361-a826-4764-b680-9d1d05f9ad45";
const followerDisplayOverrides = new Map([
  [pinoySellerId, 88],
]);

export function publicSellerFollowerCount(sellerId, actualCount) {
  return followerDisplayOverrides.get(sellerId) ?? Number(actualCount || 0);
}

const displayRecommendations = [
  { id: "display-collector", author: "Collectibles enthusiast", body: "Clear photos and detailed item descriptions make the collectible listings easy to browse." },
  { id: "display-bidder", author: "Auction enthusiast", body: "Visible starting prices, bid increases and closing times help bidders understand an auction before joining." },
  { id: "display-buyer", author: "Marketplace shopper", body: "Having payment and shipping details together makes it easier to plan a purchase." },
];

export function sellerDisplayRecommendations(sellerId) {
  return sellerId === pinoySellerId ? displayRecommendations : [];
}

export function publicSellerRecommendationCount(sellerId, actualCount) {
  return Number(actualCount || 0) + sellerDisplayRecommendations(sellerId).length;
}
