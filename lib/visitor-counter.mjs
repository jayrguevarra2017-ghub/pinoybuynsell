export function visitorToken(storage, cryptoImpl = globalThis.crypto) {
  let visitor;
  try { visitor = storage?.getItem("pinoybuynsell-visitor"); } catch { /* Private browsing can block storage. */ }
  if (/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(visitor || "")) return visitor;
  if (cryptoImpl.randomUUID) visitor = cryptoImpl.randomUUID();
  else {
    const bytes = cryptoImpl.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
    visitor = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  try { storage?.setItem("pinoybuynsell-visitor", visitor); } catch { /* Count the visit even without storage. */ }
  return visitor;
}

export async function recordVisit({ url, publicKey, visitor, signal, fetchImpl = fetch }) {
  if (!url || !publicKey) throw new Error("Visitor counter unavailable");
  // The counter is public. Never attach a customer's session/JWT or require sign-in.
  const response = await fetchImpl(`${url.replace(/\/$/, "")}/rest/v1/rpc/record_marketplace_visit`, {
    method: "POST", headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_visitor: visitor }), signal, cache: "no-store",
  });
  if (!response.ok) throw new Error("Visitor counter unavailable");
  const total = await response.json();
  if (!/^\d+$/.test(String(total))) throw new Error("Visitor counter unavailable");
  return String(total);
}
