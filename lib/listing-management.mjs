import { listingAvailability } from "./listing-order.mjs";
import { requireSellingAccess } from "./selling-access.mjs";
import { withDeadline } from "./verification-actions.js";
import { createListing } from "./listing-photo.js";

export const managementListingFields = "*,auctions(id,status,starts_at,ends_at,created_at,starting_price,current_bid)";
const validId = id => /^[1-9]\d{0,18}$/.test(String(id));

export function canRelistListing(product, userId, now = Date.now()) {
  return Boolean(userId && product?.seller_id === userId && !product.deleted_at
    && ["ended", "sold", "out-of-stock"].includes(listingAvailability(product, now).state));
}

export async function readRelistSource(client, userId, listingId, now = Date.now()) {
  if (!validId(listingId) || !userId) throw Error("Choose one of your ended listings.");
  await requireSellingAccess(client);
  const auth = await withDeadline(client.auth.getUser());
  if (auth.error || auth.data?.user?.id !== userId) throw Error("Your account changed. Sign in again before relisting.");
  const result = await withDeadline(client.from("products").select(managementListingFields)
    .eq("id", String(listingId)).eq("seller_id", userId).single());
  if (result.error) throw Error("Could not check this listing. Refresh before relisting.");
  if (String(result.data?.id) !== String(listingId) || !canRelistListing(result.data, userId, now))
    throw Error("Only your ended, sold or out-of-stock listings can be relisted. Deleted listings cannot be relisted.");
  return result.data;
}

// Copy only editable item fields. IDs, ownership, bids, deletion and Facebook
// records belong to the old listing and must never be copied into the new one.
const relistFields = ["title", "description", "price", "category", "condition", "location",
  "shipping_carrier", "shipping_fee", "listing_policy_version", "listing_type", "quantity",
  "variations", "auction_starting_price", "auction_ends_at"];

export async function relistListing(client, userId, sourceId, values, photos) {
  await readRelistSource(client, userId, sourceId);
  const editable = Object.fromEntries(relistFields.filter(key => Object.hasOwn(values, key)).map(key => [key, values[key]]));
  if (!(Number(editable.quantity) > 0)) throw Error("Enter an available quantity before relisting.");
  // No change is made to the original product or auction, even when it has bids.
  const data = await withDeadline(createListing(client, userId, { ...editable, status: "active" }, photos));
  if (!validId(data?.id) || String(data.id) === String(sourceId))
    throw Error("Could not confirm the new listing. Check My listings before trying again.");
  return data;
}

export async function deleteAdminListing(client, listingId, reason) {
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  if (!validId(listingId) || !trimmed || trimmed.length > 500) throw Error("Enter a deletion reason, up to 500 characters.");
  await requireSellingAccess(client);
  const result = await withDeadline(client.rpc("admin_delete_listing", { p_listing_id: String(listingId), p_reason: trimmed }));
  if (result.error) {
    if (result.error.code === "PGRST202") throw Error("Administrator listing deletion is not available. Its database setup must be installed.");
    throw Error(result.error.message || "Could not confirm deletion. Refresh listings before retrying.");
  }
  if (String(result.data?.id) !== String(listingId) || !Number.isFinite(Date.parse(result.data?.deleted_at)))
    throw Error("Could not confirm deletion. Refresh listings before retrying.");
  return result.data;
}
