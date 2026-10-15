import test from "node:test";
import assert from "node:assert/strict";
import { submitUSARequest } from "../lib/usa-shopping.js";
const id = "33333333-3333-4333-8333-333333333333";
const form = { contact_name: " Buyer ", contact_email: "buyer@example.com", contact_phone: "09000000000", destination: " Cavite ", item_name: "Collectible", item_url: "https://www.amazon.com/dp/TEST", quantity: "2", item_details: "Blue, standard size" };
function fixture(result, pending = false) {
  const calls = []; let signal;
  const query = { abortSignal(value) { signal = value; return this; }, then(resolve, reject) { return (pending ? new Promise(() => {}) : Promise.resolve(result)).then(resolve, reject); } };
  return { calls, get signal() { return signal; }, client: { rpc(...args) { calls.push(args); return query; } } };
}
test("USA quotes validate before writing and require a real request reference", async () => {
  const f = fixture({ data: id }); assert.equal(await submitUSARequest(f.client, form), id);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0][0], "submit_usa_shopping_request");
  assert.equal(f.calls[0][1].p_contact_name, "Buyer"); assert.equal(f.calls[0][1].p_quantity, 2);
  for (const data of [null, undefined, {}, "", "not-a-reference"]) await assert.rejects(submitUSARequest(fixture({ data }).client, form), /may already have been saved/);
  const invalid = fixture({ data: id }); await assert.rejects(submitUSARequest(invalid.client, { ...form, quantity: "0" }), /quantity/); assert.equal(invalid.calls.length, 0);
});
test("stalled USA quotes stop waiting, abort the request, and do not retry it", async () => {
  const f = fixture(null, true); await assert.rejects(submitUSARequest(f.client, form, { timeoutMs: 10 }), /Check with the team/);
  assert.equal(f.calls.length, 1); assert.equal(f.signal.aborted, true);
});
test("cancelled quote forms cannot send writes or accept a late success", async () => {
  const c = new AbortController(); c.abort(); const f = fixture({ data: id });
  await assert.rejects(submitUSARequest(f.client, form, { signal: c.signal }), /cancelled/); assert.equal(f.calls.length, 0);
  const d = new AbortController(), g = fixture({ data: id });
  const attempt = submitUSARequest(g.client, form, { signal: d.signal }); d.abort();
  await assert.rejects(attempt, /could not confirm/i); assert(g.signal.aborted);
});
test("a missing quote service is distinct from a saved or uncertain request", async () => {
  await assert.rejects(submitUSARequest(fixture({ error: { code: "PGRST202" } }).client, form), /not available yet/);
  await assert.rejects(submitUSARequest(fixture({ error: { message: "Daily request limit reached" } }).client, form), /Daily request limit/);
});
