import test from "node:test";
import assert from "node:assert/strict";
import { readIdentityStatus, submitIdentity } from "../lib/identity-verification.mjs";
const id = "11111111-1111-4111-8111-111111111111";
const form = { name: " Test Buyer ", type: "Passport", file: { type: "image/png", size: 20 } };
function fixture(options = {}) {
  const calls = [];
  function query(stage, result) {
    return { select(value) { calls.push(["select", value]); return this; }, eq(...args) { calls.push(["eq", ...args]); return this; }, maybeSingle() { return this; }, abortSignal(signal) { calls.push(["signal", stage, signal]); return this; }, then(resolve, reject) { return (options.hold === stage ? new Promise(() => {}) : Promise.resolve(result)).then(resolve, reject); } };
  }
  return { calls, client: {
    from(table) { calls.push(["read", table]); return query("read", options.read || { data: null }); },
    storage: { from(bucket) { return { upload(...args) { calls.push(["upload", bucket, ...args]); return options.hold === "upload" ? new Promise(resolve => { options.releaseUpload = resolve; }) : Promise.resolve(options.upload || { data: { path: "fixture" } }); } }; } },
    rpc(...args) { calls.push(["rpc", ...args]); return query("rpc", options.rpc || { data: null }); },
  } };
}
test("ID status reads accept only the account's valid status or confirmed absence", async () => {
  const f = fixture(); assert.equal(await readIdentityStatus(f.client, id), null);
  assert(f.calls.some(call => call[0] === "eq" && call[1] === "user_id" && call[2] === id));
  assert(f.calls.some(call => call[0] === "select" && call[1] === "user_id,status,review_note"));
  for (const status of ["pending", "approved", "rejected"]) {
    assert.equal((await readIdentityStatus(fixture({ read: { data: { user_id: id, status } } }).client, id)).status, status);
  }
  for (const read of [{ error: {} }, {}, { data: {} }, { data: [] }, { data: { user_id: "other", status: "pending" } }, { data: { user_id: id, status: "unknown" } }]) {
    await assert.rejects(readIdentityStatus(fixture({ read }).client, id), /Refresh the status/);
  }
});
test("unavailable or already submitted verification prevents every upload and submission", async () => {
  for (const read of [{ error: {} }, { data: { user_id: id, status: "pending" } }, { data: { user_id: id, status: "approved" } }]) {
    const f = fixture({ read }); await assert.rejects(submitIdentity(f.client, id, form));
    assert.equal(f.calls.filter(call => ["upload", "rpc"].includes(call[0])).length, 0);
  }
  const slow = fixture({ hold: "read" }); await assert.rejects(readIdentityStatus(slow.client, id, { timeoutMs: 10 }), /Refresh the status/);
});
test("ID submissions upload only to private own-account storage before a single submit RPC", async () => {
  const f = fixture(); await submitIdentity(f.client, id, form);
  const upload = f.calls.find(call => call[0] === "upload"), rpc = f.calls.find(call => call[0] === "rpc");
  assert.equal(upload[1], "identity-documents"); assert(upload[2].startsWith(id + "/")); assert(upload[2].endsWith(".png"));
  assert.deepEqual(upload[4], { contentType: "image/png", upsert: false });
  assert.deepEqual(rpc, ["rpc", "submit_identity", { p_name: "Test Buyer", p_type: "Passport", p_path: upload[2] }]);
  assert(f.calls.indexOf(upload) < f.calls.indexOf(rpc));
});
test("invalid ID inputs never reach status, storage or submit endpoints", async () => {
  for (const change of [{ name: "x" }, { type: "not an ID" }, { file: null }, { file: { type: "image/heic", size: 20 } }, { file: { type: "image/png", size: 6000000 } }]) {
    const f = fixture(); await assert.rejects(submitIdentity(f.client, id, { ...form, ...change })); assert.equal(f.calls.length, 0);
  }
});
test("failed and stalled uploads never proceed to the ID submit RPC or automatically retry", async () => {
  for (const options of [{ upload: { error: {} } }, { hold: "upload" }]) {
    const f = fixture(options); await assert.rejects(submitIdentity(f.client, id, form, { timeoutMs: 10 }), /may already have been saved/);
    assert.equal(f.calls.filter(call => call[0] === "upload").length, 1); assert.equal(f.calls.filter(call => call[0] === "rpc").length, 0);
  }
  const f = fixture({ hold: "rpc" }); await assert.rejects(submitIdentity(f.client, id, form, { timeoutMs: 10 }), /Refresh your verification status/);
  assert.equal(f.calls.filter(call => call[0] === "rpc").length, 1);
});
test("changing accounts while an ID uploads prevents its submission for the next account", async () => {
  const options = { hold: "upload" }, f = fixture(options), c = new AbortController();
  const pending = submitIdentity(f.client, id, form, { signal: c.signal });
  while (!options.releaseUpload) await new Promise(resolve => setImmediate(resolve));
  c.abort(); options.releaseUpload({ data: { path: "fixture" } });
  await assert.rejects(pending); assert.equal(f.calls.filter(call => call[0] === "rpc").length, 0);
});
