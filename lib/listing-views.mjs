import { listingLikeId } from "./listing-likes.mjs";

export const initialListingViews = Object.freeze({ count: null, error: false });

export function parseListingViews(rows, ids) {
  if (!Array.isArray(rows)) throw Error("View counts unavailable.");
  const allowed = new Set(ids), counts = new Map();
  for (const row of rows) {
    if (!row || !allowed.has(row.listing_id) || counts.has(row.listing_id)
      || typeof row.view_count !== "string" || !/^(0|[1-9]\d{0,18})$/.test(row.view_count)
      || BigInt(row.view_count) > 9223372036854775807n) throw Error("View counts unavailable.");
    counts.set(row.listing_id, { count: row.view_count, error: false });
  }
  return counts;
}

export async function listingViewsRPC(name, args, { url, publicKey, fetchImpl = fetch, timeoutMs = 8000 }) {
  if (!url || !publicKey || !["marketplace_listing_view_counts", "record_marketplace_listing_view"].includes(name))
    throw Error("View counts unavailable.");
  const controller = new AbortController(); let timer;
  try {
    return await Promise.race([(async () => {
      const response = await fetchImpl(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
        method: "POST", headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(args), cache: "no-store", credentials: "omit", redirect: "error", signal: controller.signal,
      });
      if (!response.ok) throw Error("View counts unavailable.");
      return response.json();
    })(), new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error("View counts unavailable.")); }, timeoutMs); })]);
  } finally { clearTimeout(timer); }
}

// Cards only read totals. Opening an item page records a view, and all copies
// of that item share its confirmed total. No invented/optimistic counts.
export function createListingViewsStore({ read, record, batchDelayMs = 20, now = () => Date.now() }) {
  const records = new Map(), listeners = new Map(), versions = new Map(), pending = new Set(), recorded = new Map(), recording = new Set();
  let enabled = false, disposed = false, timer = null;
  const get = id => records.get(id) || initialListingViews;
  const bump = id => { const value = (versions.get(id) || 0) + 1; versions.set(id, value); return value; };
  const put = (id, state) => { if (!disposed) { records.set(id, state); listeners.get(id)?.forEach(fn => fn()); } };
  const schedule = () => { if (timer === null) timer = setTimeout(() => { timer = null; flush(); }, batchDelayMs); };
  function refresh(id) {
    if (!enabled || disposed || !listingLikeId(id)) return;
    bump(id); pending.add(id); schedule();
  }
  async function flush() {
    if (!enabled || disposed) return;
    const ids = [...pending].slice(0, 100); ids.forEach(id => pending.delete(id));
    if (!ids.length) return;
    const requested = new Map(ids.map(id => [id, versions.get(id)]));
    try {
      const result = parseListingViews(await read(ids), ids);
      for (const id of ids) if (versions.get(id) === requested.get(id)) put(id, result.get(id) || { count: null, error: true });
    } catch { for (const id of ids) if (versions.get(id) === requested.get(id)) put(id, { count: get(id).count, error: true }); }
    if (pending.size && enabled && !disposed) schedule();
  }
  return {
    get,
    subscribe(id, fn) {
      if (!listeners.has(id)) listeners.set(id, new Set()); listeners.get(id).add(fn);
      refresh(id);
      return () => { listeners.get(id)?.delete(fn); if (!listeners.get(id)?.size) listeners.delete(id); };
    },
    activate(ready) { disposed = false; enabled = ready; if (ready) listeners.forEach((_, id) => refresh(id)); },
    refresh,
    refreshVisible() { listeners.forEach((_, id) => refresh(id)); },
    async record(id) {
      if (!enabled || disposed || !listingLikeId(id) || recording.has(id)) return;
      const day = new Date(now()).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
      if (recorded.get(id) === day) return;
      recording.add(id);
      try {
        const result = parseListingViews([await record(id)], [id]).get(id);
        if (disposed) return;
        bump(id); pending.delete(id); put(id, result); recorded.set(id, day);
      } catch { if (!disposed) refresh(id); } // Read only after an uncertain write; never automatically repeat it.
      finally { recording.delete(id); }
    },
    dispose() { disposed = true; enabled = false; clearTimeout(timer); timer = null; pending.clear(); versions.forEach((_, id) => bump(id)); }
  };
}
