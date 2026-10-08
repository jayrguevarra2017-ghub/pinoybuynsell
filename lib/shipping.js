export const shippingCarriers = ["LBC", "J&T Express", "JRS Express", "Ninja Van", "Flash Express", "Other courier"];

export function validateShipping(carrier, fee) {
  if (!shippingCarriers.includes(carrier)) return "Select a shipping carrier.";
  if (!/^\d+(\.\d{1,2})?$/.test(String(fee)) || !Number.isFinite(Number(fee)) || Number(fee) < 0 || Number(fee) > 99999999.99) {
    return "Enter a shipping fee from ₱0 to ₱99,999,999.99 with up to two decimal places.";
  }
  return "";
}

export function shippingLabel(product) {
  if (!product.shipping_carrier || product.shipping_fee == null) return "Shipping details not provided";
  const fee = Number(product.shipping_fee);
  return `${product.shipping_carrier} · ${fee === 0 ? "Free shipping" : `Shipping: ₱${fee.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}`;
}
