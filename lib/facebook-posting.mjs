export const legacyFacebookBlockedMessage = "Facebook has restricted publishing for this Page or account. Review its Account Status in Facebook before retrying.";
export const facebookBlockedMessage = "Facebook blocked this publishing request (error 368). The link, app or a temporary posting block may be involved, even if Page status shows no issues. Check Account Status and Meta's Sharing Debugger before retrying.";

export function facebookDebuggerUrl(listingId) {
  if (typeof listingId !== "string" && !(Number.isSafeInteger(listingId) && listingId > 0)) return null;
  if (!validFacebookListingId(String(listingId))) return null;
  return `https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(`https://pinoybuynsell.com/product/${encodeURIComponent(String(listingId))}`)}`;
}

export function facebookPostingBlocked(record) {
  return ["failed", "published"].includes(record?.status) && typeof record?.message === "string"
    && (record.message.includes(legacyFacebookBlockedMessage) || record.message.includes("(error 368)"));
}

export function validFacebookListingId(value) {
  return typeof value === "string" && /^[A-Za-z0-9-]{1,100}$/.test(value);
}

export function facebookPublishingUrl(id) {
  const value = String(id);
  if (!validFacebookListingId(value)) return null;
  return `/admin/facebook?listing=${encodeURIComponent(value)}`;
}

export function canPublishListingToPage(product, user, admin) {
  return admin === true && Boolean(user?.id) && product?.seller_id === user.id
    && product.status === "active" && !product.deleted_at;
}

export async function withFacebookDeadline(operation, milliseconds = 8000) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error("Facebook posting check timed out.")), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export function facebookPostingState(record, now = Date.now()) {
  // Correct older saved guidance without modifying the posting record or
  // making another Meta request. Caption-update errors keep their prefix.
  if (typeof record?.message === "string" && record.message.includes(legacyFacebookBlockedMessage)) record = {
    ...record, message: record.message.replace(legacyFacebookBlockedMessage, facebookBlockedMessage),
  };
  if (record?.status === "processing" && now - Date.parse(record.updated_at) > 120000) return {
    ...record, status: "uncertain", message: "Posting was interrupted. Check Facebook before another attempt.",
  };
  return record;
}

export async function publishFacebookListing(client, listingId, { fetchImpl = fetch, timeoutMs = 65000, sessionTimeoutMs = 8000 } = {}) {
  if (!validFacebookListingId(listingId)) throw Error("Invalid listing ID.");
  const session = await withFacebookDeadline(client.auth.getSession(), sessionTimeoutMs);
  const token = session.data?.session?.access_token;
  if (session.error || !token) throw Error("Sign in again before posting.");
  const controller = new AbortController();
  let timer;
  try {
    // Bound the entire response, including reading JSON. Abort alone is not a
    // deadline if an intermediary never settles the fetch promise.
    return await Promise.race([
      (async () => {
        const response = await fetchImpl("/api/facebook/publish", {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ listingId }), signal: controller.signal, cache: "no-store",
        });
        const result = await response.json();
        if (!result || typeof result.message !== "string") throw Error("Could not confirm the posting result.");
        return result;
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => {
        controller.abort(); reject(Error("Posting timed out. Check the Facebook Page and refresh status before trying again."));
      }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
