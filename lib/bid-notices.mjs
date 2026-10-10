import { validBidNotices } from "./bid-notice-content.mjs";
import { withDeadline } from "./verification-actions.js";

export const emptyBidNotices = Object.freeze({ items: [], hasMore: false, hasListings: false, ready: false,
  refreshing: false, marking: false, error: "", updatedAt: null, notice: null });

export async function requestBidNotices(client, userId, { ids, signal, fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const controller = new AbortController(), cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true }); if (signal?.aborted) cancel();
  try {
    return await withDeadline((async () => {
      const session = await client.auth.getSession();
      if (controller.signal.aborted) throw Error("Cancelled");
      if (session.error || session.data?.session?.user?.id !== userId || !session.data.session.access_token)
        throw Error("Sign in again to check your bid notifications.");
      const response = await fetchImpl("/api/marketplace/bid-notifications", { method: ids ? "POST" : "GET", signal: controller.signal, cache: "no-store",
        headers: { Authorization: `Bearer ${session.data.session.access_token}`, ...(ids ? { "Content-Type": "application/json" } : {}) },
        ...(ids ? { body: JSON.stringify({ ids }) } : {}) });
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "Bid notifications are unavailable. Please try again.");
      if (!validBidNotices(result, userId)) throw Error("Bid notifications could not be confirmed. Please refresh.");
      return result;
    })(), timeoutMs);
  } finally { controller.abort(); signal?.removeEventListener("abort", cancel); }
}

export function createBidNoticeStore({ read, mark, now = Date.now }) {
  let state = emptyBidNotices, active = false, sequence = 0, controller;
  const listeners = new Set();
  const publish = value => { state = value; listeners.forEach(listener => listener()); };
  async function run(ids) {
    if (!active || state.marking || (!ids && state.refreshing)) return;
    const request = ++sequence;
    controller?.abort(); controller = new AbortController();
    publish({ ...state, refreshing: !ids, marking: Boolean(ids), error: "" });
    try {
      const result = ids ? await mark(ids, controller.signal) : await read(controller.signal);
      if (!active || request !== sequence) return;
      const previous = new Set(state.items.map(item => item.id));
      const arrived = state.ready ? result.items.filter(item => !item.read && !previous.has(item.id)) : [];
      const notice = state.notice && result.items.some(item => item.id === state.notice.id && !item.read) ? state.notice : null;
      publish({ ...result, ready: true, refreshing: false, marking: false, error: "", updatedAt: now(),
        notice: arrived.length ? { ...arrived[0], count: arrived.length } : notice });
    } catch (error) {
      if (active && request === sequence) publish({ ...state, refreshing: false, marking: false, error: error.message || "Bid notifications are unavailable. Please refresh." });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    refresh: () => run(),
    markRead(ids) {
      const selected = [...new Set(ids)].filter(id => state.items.some(item => item.id === id && !item.read));
      return selected.length ? run(selected) : Promise.resolve();
    },
    dismiss: () => publish({ ...state, notice: null }),
    activate(value) {
      if (active === value) return;
      active = value;
      if (value) void run();
      else { sequence++; controller?.abort(); publish(emptyBidNotices); }
    },
  };
}

export function unreadBidCount(state) { return state?.ready ? state.items.filter(item => !item.read).length : null; }
