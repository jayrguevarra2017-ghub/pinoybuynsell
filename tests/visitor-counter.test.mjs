import { test } from "node:test";
import assert from "node:assert/strict";
import { visitorToken, recordVisit } from "../lib/visitor-counter.mjs";

const id = "11111111-1111-4111-8111-111111111111";
test("the same stored browser token is reused across page visits", () => {
  let value = null, created = 0;
  const storage = { getItem: () => value, setItem: (_key, token) => { value = token; } };
  const cryptoImpl = { randomUUID: () => { created++; return id; } };
  assert.equal(visitorToken(storage, cryptoImpl), id);
  assert.equal(visitorToken(storage, cryptoImpl), id);
  assert.equal(created, 1);
});
test("blocked storage and older browsers can still generate a visitor token", () => {
  const storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  const cryptoImpl = { getRandomValues: bytes => { bytes.fill(3); return bytes; } };
  assert.match(visitorToken(storage, cryptoImpl), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
test("counting uses public credentials without relying on the user's signed-in session", async () => {
  let request;
  const total = await recordVisit({ url: "https://example.supabase.co/", publicKey: "public-key", visitor: id,
    fetchImpl: async (url, options) => { request = { url, options }; return Response.json(0); } });
  assert.equal(total, "0");
  assert.equal(request.url, "https://example.supabase.co/rest/v1/rpc/record_marketplace_visit");
  assert.equal(request.options.headers.Authorization, "Bearer public-key");
  assert.equal(request.options.headers.apikey, "public-key");
  assert.deepEqual(JSON.parse(request.options.body), { p_visitor: id });
});
test("failed or invalid counter responses cannot invent visitor totals", async () => {
  for (const response of [Response.json({ message: "private provider details" }, { status: 401 }), Response.json(-1), Response.json({ total: 5 }), Response.json("NaN")]) {
    await assert.rejects(recordVisit({ url: "https://example.supabase.co", publicKey: "public-key", visitor: id,
      fetchImpl: async () => response }), /^Error: Visitor counter unavailable$/);
  }
});
