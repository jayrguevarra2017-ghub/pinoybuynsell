import { withDeadline } from "./verification-actions.js";

export async function submitMarketplaceBid(client, { auction, product, user, amountText }, { timeoutMs = 20000, isCurrent = () => true, now = () => Date.now() } = {}) {
  const current = Math.max(Number(auction?.current_bid ?? 0), Number(auction?.starting_price ?? 0));
  const amount = Number(amountText);
  if (!user?.id || user.id === product?.seller_id) throw Error("Sign in with an eligible buyer account before bidding.");
  const available = () => product?.status === "active" && !product.deleted_at && product.listing_type !== "fixed_price"
    && auction?.status === "active" && Date.parse(auction.ends_at) > now()
    && (!auction.starts_at || Date.parse(auction.starts_at) <= now());
  if (!available()) throw Error("This auction is not open for bidding.");
  if (!/^\d+(\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount) || !Number.isFinite(current) || amount <= current)
    throw Error("Enter a bid higher than the current bid, with up to two decimal places.");
  let verification;
  try { verification = await withDeadline(client.rpc("is_marketplace_verified"), timeoutMs); }
  catch { throw Error("Could not check bidding approval. Refresh before trying again."); }
  if (verification.error || verification.data !== true) throw Error("Submit your ID and wait for administrator approval before bidding.");
  if (!isCurrent()) throw Error("Your sign-in or listing changed. Review the auction before bidding.");
  if (!available()) throw Error("This auction is not open for bidding.");
  let result;
  try { result = await withDeadline(client.rpc("place_marketplace_bid", { p_auction_id: String(auction.id), p_amount: amount }), timeoutMs); }
  catch { throw Error("Could not confirm your bid. Refresh to check the current price before trying again."); }
  if (result.error) throw Error(result.error.code === "PGRST202" ? "Bidding is not available yet. Please try again later." : result.error.message || "Your bid was rejected. Refresh the auction before trying again.");
  if (!result.data || String(result.data.id) !== String(auction.id) || !Number.isFinite(Number(result.data.current_bid)) || Number(result.data.current_bid) < amount)
    throw Error("Could not confirm your bid. Refresh to check the current price before trying again.");
  return result.data;
}
