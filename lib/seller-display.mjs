// Owner-requested display count; this does not create or modify follower records.
const pinoySellerId = "29ee4361-a826-4764-b680-9d1d05f9ad45";
const followerDisplayOverrides = new Map([
  [pinoySellerId, 88],
]);

export function publicSellerFollowerCount(sellerId, actualCount) {
  return followerDisplayOverrides.get(sellerId) ?? Number(actualCount || 0);
}

const sampleRecommendations = [
  { id: "sample-collector", author: "Sample collector", body: "Clear photos and detailed item descriptions make the collectible listings easy to browse." },
  { id: "sample-bidder", author: "Sample bidder", body: "Visible starting prices, bid increases and closing times help bidders understand an auction before joining." },
  { id: "sample-buyer", author: "Sample buyer", body: "Having payment and shipping details together makes it easier to plan a purchase." },
];

export function sellerRecommendationSamples(sellerId) {
  return sellerId === pinoySellerId ? sampleRecommendations : [];
}
