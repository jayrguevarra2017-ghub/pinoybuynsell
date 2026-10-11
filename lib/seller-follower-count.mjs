import { communityRequest, validSellerId } from "./seller-community.mjs";

export const followerCountError = "Your follower count could not be updated. Try refreshing it.";

export async function readSellerFollowerCount(client, sellerId, { signal, timeoutMs = 8000 } = {}) {
  if (!validSellerId(sellerId)) throw Error(followerCountError);
  try {
    let request = client.rpc("marketplace_seller_profile", { p_seller_id: sellerId });
    if (signal) request = request.abortSignal(signal);
    const profile = await communityRequest(request, timeoutMs);
    if (!profile || profile.id !== sellerId || !Number.isSafeInteger(profile.follower_count) || profile.follower_count < 0)
      throw Error(followerCountError);
    return profile.follower_count;
  } catch { throw Error(followerCountError); }
}
