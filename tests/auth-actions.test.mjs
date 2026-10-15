import test from "node:test";
import assert from "node:assert/strict";
import { runAuthAction } from "../lib/auth-actions.mjs";

function fixture(result, pending = false) {
  const calls = [];
  const action = name => (...args) => { calls.push([name, ...args]); return pending ? new Promise(() => {}) : Promise.resolve(result); };
  return { calls, client: { auth: { signInWithPassword: action("login"), signUp: action("signup"), resetPasswordForEmail: action("recovery"), signOut: action("logout") } } };
}
test("account actions have a deadline and never automatically repeat a request", async () => {
  for (const action of ["login", "signup", "recovery", "logout"]) {
    const f = fixture(null, true);
    await assert.rejects(runAuthAction(f.client, action, {}, { timeoutMs: 10 }), /could not be confirmed/);
    assert.equal(f.calls.length, 1);
  }
});
test("login requires a confirmed user/session and preserves provider rejection messages", async () => {
  const f = fixture({ data: { user: { id: "member" }, session: { access_token: "fixture" } } });
  await runAuthAction(f.client, "login", { email: " buyer@example.com ", password: " password " });
  assert.deepEqual(f.calls[0], ["login", { email: "buyer@example.com", password: " password " }]);
  for (const result of [undefined, {}, { data: {} }, { data: { user: { id: "member" } } }]) {
    await assert.rejects(runAuthAction(fixture(result).client, "login"), /could not be confirmed/);
  }
  await assert.rejects(runAuthAction(fixture({ error: { message: "Invalid login credentials" } }).client, "login"), /Invalid login credentials/);
});
test("signup and recovery use their own redirect and cannot call an unrelated auth method", async () => {
  const f = fixture({ data: { user: { id: "member" } } });
  const values = { email: "buyer@example.com", password: "password123", redirectTo: "https://fixture.invalid/login?next=%2Fusa-shopping" };
  await runAuthAction(f.client, "signup", values);
  assert.deepEqual(f.calls[0], ["signup", { email: values.email, password: values.password, options: { emailRedirectTo: values.redirectTo } }]);
  const recovery = fixture({}); await runAuthAction(recovery.client, "recovery", values);
  assert.deepEqual(recovery.calls[0], ["recovery", values.email, { redirectTo: values.redirectTo }]);
  await assert.rejects(runAuthAction(f.client, "other"), /valid account action/); assert.equal(f.calls.length, 1);
});
