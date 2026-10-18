import { usaItemId } from "./usa-items.mjs";
import { withFacebookDeadline } from "./facebook-posting.mjs";

export async function publishUSAItem(client, itemId, { fetchImpl = fetch, timeoutMs = 120000, sessionTimeoutMs = 8000 } = {}) {
  if (!usaItemId(itemId)) throw Error("Invalid USA item ID.");
  const session = await withFacebookDeadline(client.auth.getSession(), sessionTimeoutMs);
  const token = session.data?.session?.access_token;
  if (session.error || !token) throw Error("Sign in again before posting.");
  const controller = new AbortController();
  try {
    return await withFacebookDeadline((async () => {
      const response = await fetchImpl("/api/facebook/usa/publish", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }), signal: controller.signal, cache: "no-store",
      });
      const result = await response.json();
      if (!result || typeof result.message !== "string") throw Error("Could not confirm the posting result.");
      return result;
    })(), timeoutMs);
  } finally { controller.abort(); }
}
