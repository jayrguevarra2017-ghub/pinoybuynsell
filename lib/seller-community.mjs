export function validSellerId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function sellerUrl(id) {
  return validSellerId(id) ? `/seller/${id}` : null;
}

export function validateRecommendation(body) {
  const value = typeof body === "string" ? body.trim() : "";
  if ([...value].length < 10 || [...value].length > 1000) throw Error("Write a recommendation between 10 and 1000 characters.");
  return value;
}

export async function communityRequest(operation, milliseconds = 10000) {
  let timer;
  try {
    const result = await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error("The request took too long. Refresh to check before trying again.")), milliseconds);
    })]);
    if (result?.error) throw result.error;
    return result?.data;
  } finally { clearTimeout(timer); }
}

export function communityError(error) {
  if (["PGRST202", "PGRST205", "42883", "42P01"].includes(error?.code)) return "Seller following and recommendations are temporarily unavailable. Please try again later.";
  if (error?.code === "P0001" || error instanceof Error) return error.message;
  return "Could not save or load this information. Refresh to check before trying again.";
}

export function announceSellerChange(sellerId) {
  window.dispatchEvent(new CustomEvent("marketplace-seller-change", { detail: sellerId }));
}
