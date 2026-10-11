import { bidIncrementSettings } from "./bid-increments.mjs";

export const maxListingQuantity = 1000000;
export const maxVariations = 20;

export function validateListingOptions(form, now = Date.now(), locked = false) {
  if (!["fixed_price", "auction"].includes(form.listing_type)) return "Choose fixed price or bidding.";
  if (!/^\d+$/.test(String(form.quantity)) || Number(form.quantity) > maxListingQuantity) return "Enter a whole quantity from 0 to 1,000,000.";
  if (!Array.isArray(form.variations) || form.variations.length > maxVariations) return "Use up to 20 variations.";
  const names = new Set();
  for (const variation of form.variations) {
    const name = String(variation.name || "").trim();
    if (!name || name.length > 100) return "Give each variation a name, up to 100 characters.";
    if (names.has(name.toLowerCase())) return "Give each variation a different name.";
    names.add(name.toLowerCase());
    if (!/^\d+$/.test(String(variation.quantity)) || Number(variation.quantity) > maxListingQuantity) return "Enter a whole quantity for each variation.";
  }
  if (form.variations.length && form.variations.reduce((total, v) => total + Number(v.quantity), 0) !== Number(form.quantity)) return "Total quantity must match the quantities of your variations.";
  if (form.listing_type === "auction") {
    try { bidIncrementSettings(form); } catch (error) { return error.message; }
    if (Number(form.quantity) !== 1 || form.variations.length) return "An auction is for one item or lot, without selectable variations.";
    const price = String(form.auction_starting_price);
    if (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) <= 0 || Number(price) > 99999999999999.99) return "Enter a positive starting bid with up to two decimal places.";
    const ends = Date.parse(form.auction_ends_at);
    if (!Number.isFinite(ends) || (!locked && ends <= now)) return "Choose an auction closing time in the future.";
  }
  return "";
}

// Seller date/time inputs explicitly use Philippine time, regardless of browser locale.
export function toManilaInput(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Date(Date.parse(value) + 8 * 60 * 60 * 1000).toISOString().slice(0, 19);
}
export function fromManilaInput(value) {
  return value ? new Date(`${value}+08:00`).toISOString() : null;
}
