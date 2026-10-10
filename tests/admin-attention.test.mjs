import test from "node:test";
import assert from "node:assert/strict";
import { adminAttentionLabel, createAdminAttentionStore, emptyAdminAttention, readAdminAttention } from "../lib/admin-attention.mjs";

function fixture({ access = true, accessError = false, counts = [2, 3, 4], hang = false } = {}) {
  const requests = [];
  const client = {
    rpc(name) {
      assert.equal(name, "is_marketplace_admin");
      return { abortSignal: async signal => {
        assert(signal instanceof AbortSignal);
        return hang ? new Promise(() => {}) : { data: access, error: accessError ? { message: "private-error" } : null };
      } };
    },
    from(table) {
      const request = { table }; requests.push(request);
      return {
        select(column, options) { Object.assign(request, { column, options }); return this; },
        in(column, values) { Object.assign(request, { filter: column, values }); return this; },
        async abortSignal(signal) {
          assert(signal instanceof AbortSignal);
          const count = counts[["identity_verifications", "support_tickets", "usa_shopping_requests"].indexOf(table)];
          if (count instanceof Error) throw count;
          return { count, data: null };
        },
      };
    },
  };
  return { client, requests };
}

test("admin counts use exact HEAD queries and only the actionable statuses, without a row limit", async () => {
  const f = fixture({ counts: [2001, 3, 4] });
  const result = await readAdminAttention(f.client, { now: () => 123 });
  assert.equal(result.total, 2008); assert.equal(result.updatedAt, 123);
  assert.deepEqual(result.unavailable, []);
  assert.deepEqual(f.requests, [
    { table: "identity_verifications", column: "user_id", options: { head: true, count: "exact" }, filter: "status", values: ["pending"] },
    { table: "support_tickets", column: "id", options: { head: true, count: "exact" }, filter: "status", values: ["open"] },
    { table: "usa_shopping_requests", column: "id", options: { head: true, count: "exact" }, filter: "status", values: ["new", "contacted"] },
  ]);
});

test("no task tables are queried for non-admin, unverifiable, or cancelled membership", async () => {
  for (const options of [{ access: false }, { access: "true" }, { access: null }, { accessError: true }]) {
    const f = fixture(options), result = await readAdminAttention(f.client);
    assert.equal(f.requests.length, 0); assert.equal(result.total, null);
    assert.equal(result.allowed, options.access === false ? false : null);
    assert(!JSON.stringify(result).includes("private-error"));
  }
  const controller = new AbortController(); controller.abort();
  const f = fixture(); await readAdminAttention(f.client, { signal: controller.signal });
  assert.equal(f.requests.length, 0);
});

test("failed and invalid counts remain unavailable, while valid counts give an explicitly partial total", async () => {
  for (const unavailable of [new Error("private-error"), null, undefined, -1, "3", 1.5, Infinity]) {
    const result = await readAdminAttention(fixture({ counts: [2, unavailable, 0] }).client);
    assert.deepEqual(result.counts, { verifications: 2, usa: 0 });
    assert.equal(result.total, 2); assert.deepEqual(result.unavailable, ["support"]);
    assert.match(adminAttentionLabel(result), /At least 2.*unavailable/);
    assert(!JSON.stringify(result).includes("private-error"));
  }
  const result = await readAdminAttention(fixture({ counts: [null, null, null] }).client);
  assert.equal(result.total, null); assert.match(adminAttentionLabel(result), /unavailable/);
});

test("only a complete successful zero result reports caught up; timeouts do not report zero", async () => {
  const success = await readAdminAttention(fixture({ counts: [0, 0, 0] }).client);
  assert.match(adminAttentionLabel(success), /All caught up/);
  const partial = await readAdminAttention(fixture({ counts: [0, null, 0] }).client);
  assert(!adminAttentionLabel(partial).includes("caught up"));
  const f = fixture({ hang: true });
  const result = await readAdminAttention(f.client, { timeoutMs: 5 });
  assert.equal(result.total, null); assert.equal(f.requests.length, 0);
});

test("refreshes discard earlier results and counts cannot survive deactivation or disposal", async () => {
  const pending = [], signals = [];
  const store = createAdminAttentionStore(signal => { signals.push(signal); return new Promise(resolve => pending.push(resolve)); });
  const next = total => ({ ...emptyAdminAttention, total, ready: true, allowed: true, counts: { support: total } });
  store.activate(true); const refresh = store.refresh();
  assert.equal(signals[0].aborted, true);
  pending[1](next(2)); await refresh;
  pending[0](next(99)); await Promise.resolve();
  assert.equal(store.getSnapshot().total, 2);
  const late = store.refresh(); store.activate(false);
  pending[2](next(88)); await late;
  assert.equal(store.getSnapshot(), emptyAdminAttention);
  store.activate(true); store.dispose(); pending[3](next(77)); await Promise.resolve();
  assert.equal(store.getSnapshot().total, null);
});

test("stores remain separate across accounts and can reactivate after effect cleanup", async () => {
  const admin = createAdminAttentionStore(async () => ({ ...emptyAdminAttention, ready: true, total: 8 }));
  const member = createAdminAttentionStore(async () => { throw Error("must not fetch"); });
  admin.activate(true); await admin.refresh(); assert.equal(admin.getSnapshot().total, 8);
  assert.equal(member.getSnapshot().total, null);
  admin.activate(false); admin.activate(true); await admin.refresh(); assert.equal(admin.getSnapshot().total, 8);
  admin.dispose(); member.dispose();
});
