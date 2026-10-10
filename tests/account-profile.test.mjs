import test from "node:test";
import assert from "node:assert/strict";
import { readAccountProfile, saveAccountProfile } from "../lib/account-profile.mjs";
const profile = { username: " Member ", full_name: " Private Name ", phone: " 09000000000 ", location: " Cavite ", is_admin: true };
function fixture(result, pending = false) {
  const calls = [];
  const query = { select(value) { calls.push(["select", value]); return this; }, eq(key, value) { calls.push(["eq", key, value]); return this; },
    update(value) { calls.push(["update", value]); return this; }, single() { return pending ? new Promise(() => {}) : Promise.resolve(result); },
    maybeSingle() { return pending ? new Promise(() => {}) : Promise.resolve(result); } };
  return { calls, client: { from(table) { calls.push(["from", table]); return query; } } };
}
test("profile reads are scoped to the account and do not silently turn missing or failed reads into an empty profile", async () => {
  const f = fixture({ data: profile }); const result = await readAccountProfile(f.client, "user");
  assert.equal(result.username, " Member "); assert.equal(result.is_admin, undefined); assert(f.calls.some(call => call[0] === "eq" && call[2] === "user"));
  for (const response of [{ data: null }, { data: {} }, { data: [] }, { error: { message: "private provider detail" } }]) {
    const fail = fixture(response); await assert.rejects(readAccountProfile(fail.client, "user"), /Retry before editing/);
  }
  const slow = fixture(null, true); await assert.rejects(readAccountProfile(slow.client, "user", { timeoutMs: 10 }), /timed out/);
});
test("profile saves update only editable fields and require the affected account row", async () => {
  const f = fixture({ data: { id: "user" } }); await saveAccountProfile(f.client, "user", profile);
  assert.deepEqual(f.calls.find(call => call[0] === "update")[1], { username: "Member", full_name: "Private Name", phone: "09000000000", location: "Cavite" });
  assert(f.calls.some(call => call[0] === "select" && call[1] === "id"));
  for (const response of [{ data: null }, { data: { id: "other" } }, { error: {} }]) {
    const fail = fixture(response); await assert.rejects(saveAccountProfile(fail.client, "user", profile), /Could not confirm/);
  }
});
test("stalled profile saves are bounded and never repeat the update automatically", async () => {
  const f = fixture(null, true); await assert.rejects(saveAccountProfile(f.client, "user", profile, { timeoutMs: 10 }), /timed out/);
  assert.equal(f.calls.filter(call => call[0] === "update").length, 1);
});
