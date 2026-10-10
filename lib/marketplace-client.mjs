export async function fetchMarketplaceListings(filters = {}, fetchImpl = fetch) {
  const params = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]));
  const message = "Listings could not be loaded. Please refresh to try again.";
  let timer;
  try {
    return await Promise.race([(async () => {
      const response = await fetchImpl(`/api/marketplace/listings?${params}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.items)) throw Error(message);
      return result.items;
    })(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error(message)), 20000); })]);
  } finally { clearTimeout(timer); }
}
