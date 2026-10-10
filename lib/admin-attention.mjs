export const adminAttentionQueues = [
  { key: "verifications", table: "identity_verifications", column: "user_id", label: "Pending ID reviews", href: "/admin/verifications", statuses: ["pending"] },
  { key: "support", table: "support_tickets", label: "Open support conversations", href: "/admin/support", statuses: ["open"] },
  { key: "usa", table: "usa_shopping_requests", label: "Open USA shopping requests", href: "/admin/usa-requests", statuses: ["new", "contacted"] },
];

export const emptyAdminAttention = Object.freeze({ counts: {}, unavailable: [], total: null, ready: false, refreshing: false, allowed: null, updatedAt: null });

// Count-only requests use the signed-in browser client and existing RLS. No
// customer names, contact details or ID documents are downloaded for badges.
export async function readAdminAttention(client, { signal, timeoutMs = 8000, now = Date.now } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  let timer;
  const failed = () => ({ ...emptyAdminAttention, ready: true, unavailable: adminAttentionQueues.map(q => q.key) });
  try {
    return await Promise.race([
      (async () => {
        const access = await client.rpc("is_marketplace_admin").abortSignal(controller.signal);
        if (controller.signal.aborted) throw new Error("Cancelled");
        if (access.error || typeof access.data !== "boolean") throw new Error("Access unavailable");
        if (!access.data) return { ...emptyAdminAttention, ready: true, allowed: false };
        const results = await Promise.allSettled(adminAttentionQueues.map(async queue => {
          const result = await client.from(queue.table).select(queue.column || "id", { head: true, count: "exact" })
            .in("status", queue.statuses).abortSignal(controller.signal);
          if (result.error || !Number.isSafeInteger(result.count) || result.count < 0) throw new Error("Count unavailable");
          return result.count;
        }));
        if (controller.signal.aborted) throw new Error("Cancelled");
        const counts = {}, unavailable = [];
        results.forEach((result, index) => {
          const key = adminAttentionQueues[index].key;
          if (result.status === "fulfilled") counts[key] = result.value;
          else unavailable.push(key);
        });
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        return { counts, unavailable, total: unavailable.length === adminAttentionQueues.length ? null : total,
          ready: true, refreshing: false, allowed: true, updatedAt: now() };
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => { cancel(); reject(new Error("Timeout")); }, timeoutMs); }),
    ]);
  } catch { return failed(); }
  finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
}

// An account gets its own store. Cancellation and sequence checks discard late
// results after sign-out, role changes, offline transitions or a newer refresh.
export function createAdminAttentionStore(read) {
  let state = emptyAdminAttention, active = false, disposed = false, sequence = 0, controller;
  const listeners = new Set();
  function publish(next) { state = next; listeners.forEach(listener => listener()); }
  async function refresh() {
    if (!active || disposed) return;
    const request = ++sequence;
    controller?.abort(); controller = new AbortController();
    publish({ ...state, refreshing: true });
    try {
      const result = await read(controller.signal);
      if (active && !disposed && request === sequence) publish(result);
    } catch {
      if (active && !disposed && request === sequence) publish({ ...emptyAdminAttention, ready: true, unavailable: adminAttentionQueues.map(q => q.key) });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    refresh,
    activate(value) {
      if (disposed || active === value) return;
      active = value;
      if (value) void refresh();
      else { ++sequence; controller?.abort(); publish(emptyAdminAttention); }
    },
    dispose() { disposed = true; active = false; ++sequence; controller?.abort(); listeners.clear(); },
  };
}

export function adminAttentionLabel(state) {
  if (!state?.ready) return "Checking administrator tasks…";
  if (state.total === null) return "Administrator task counts are unavailable.";
  if (state.total === 0 && state.unavailable.length) return "Some administrator task counts are unavailable.";
  if (state.unavailable.length) return `At least ${state.total} items need attention. Some counts are unavailable.`;
  return state.total === 0 ? "All caught up in these three queues." : `${state.total} ${state.total === 1 ? "item needs" : "items need"} attention.`;
}
