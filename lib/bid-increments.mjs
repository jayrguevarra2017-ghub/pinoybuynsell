import { withDeadline } from "./verification-actions.js";

const maximumCents = 9999999999999999n;
function cents(value) {
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw Error("Use a positive amount with up to two decimal places.");
  const [whole, fraction = ""] = text.split(".");
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (result > maximumCents) throw Error("This amount exceeds the bidding limit.");
  return result;
}
function money(value) { return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`; }

export const bidIncreaseChoices = Array.from({ length: 50 }, (_, index) => (index + 1) * 20);

export function bidIncrementSettings(product = {}) {
  // Old listings retain the original one-cent minimum until configured.
  const value = product.auction_bid_increment ?? "0.01";
  const units = cents(value);
  if (units !== 1n && (units < 2000n || units > 100000n || units % 2000n !== 0n))
    throw Error("Choose a minimum bid increase from ₱20 to ₱1,000, in steps of ₱20.");
  return { value: money(units), units };
}

export function minimumMarketplaceBid(auction, product) {
  const settings = bidIncrementSettings(product);
  const current = cents(auction?.current_bid ?? 0), starting = cents(auction?.starting_price ?? 0);
  const base = current > starting ? current : starting;
  const minimum = base + settings.units;
  if (minimum > maximumCents) throw Error("No higher bid can be accepted within the bidding limit.");
  return money(minimum);
}

export function validateMinimumBid(amountText, auction, product) {
  const amount = cents(amountText), minimum = minimumMarketplaceBid(auction, product);
  if (amount < cents(minimum)) throw Error(`Your bid must be at least ₱${Number(minimum).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
  return minimum;
}

export async function readBidIncrementCapability(client) {
  try {
    const result = await withDeadline(client.rpc("marketplace_bid_increment_policy"), 10000);
    if (result.error?.code === "PGRST202") return false;
    if (result.error || result.data !== "amount-steps-v1") throw Error("Unavailable bidding settings");
    return true;
  } catch { throw Error("Could not check bid increase settings. Refresh before saving an auction."); }
}
