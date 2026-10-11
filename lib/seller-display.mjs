// Owner-requested display count; this does not create or modify follower records.
const followerDisplayOverrides = new Map([
  ["29ee4361-a826-4764-b680-9d1d05f9ad45", 88],
]);

export function publicSellerFollowerCount(sellerId, actualCount) {
  return followerDisplayOverrides.get(sellerId) ?? Number(actualCount || 0);
}
