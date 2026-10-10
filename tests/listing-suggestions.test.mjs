import test from "node:test";
import assert from "node:assert/strict";
import { handleListingSuggestions, createSuggestionLimiter } from "../lib/listing-suggestions.mjs";
import { validateSuggestion } from "../lib/listing-suggestion-content.mjs";

const photo = `data:image/jpeg;base64,${Buffer.from([255, 216, 255, ...Array(30).fill(0)]).toString("base64")}`;
const suggestion = { title: "Michael Jordan basketball card", description: "A basketball trading card showing Michael Jordan.", uncertain_details: ["Confirm the year and card number."] };
function fixture(options = {}) {
  const calls = [];
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key", OPENAI_API_KEY: "private-ai-key", ...options.env };
  const client = { auth: { getUser: async token => { calls.push(["auth", token]); return options.hangAuth ? new Promise(() => {}) : options.authError ? { error: {} } : { data: { user: { id: "admin" } } }; } },
    rpc: async name => { calls.push(["rpc", name]); return options.hangAdmin ? new Promise(() => {}) : { data: options.admin ?? true, error: options.adminError }; } };
  const createClient = (...args) => { calls.push(["client", ...args]); return client; };
  const fetchImpl = async (url, request) => {
    calls.push(["provider", url, request]);
    if (options.networkError) throw Error("private-ai-key private provider error");
    if (options.hangProvider) return new Promise(() => {});
    if (options.hangJson) return { ok: true, json: () => new Promise(() => {}) };
    return Response.json(options.payload || { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(options.suggestion ?? suggestion) }] }] }, { status: options.status || 200 });
  };
  let releases = 0;
  const reserve = options.reserve || (() => () => { releases++; });
  const request = new Request("https://pinoybuynsell.com/api/marketplace/listing-suggestions", { method: "POST",
    headers: { "Content-Type": "application/json", ...(options.noAuth ? {} : { Authorization: "Bearer user-token" }), ...options.headers },
    body: options.rawBody ?? JSON.stringify(options.body || { photos: [photo] }) });
  return { calls, releases: () => releases, run: () => handleListingSuggestions(request, { env, createClient, fetchImpl, reserve, databaseTimeoutMs: 15, providerTimeoutMs: 20 }) };
}
test("only a verified administrator session can call the AI provider", async () => {
  for (const [options, status] of [[{ noAuth: true }, 401], [{ authError: true }, 401], [{ admin: false }, 403], [{ admin: {} }, 403], [{ adminError: {} }, 403]]) {
    const f = fixture(options); assert.equal((await f.run()).status, status); assert(!f.calls.some(call => call[0] === "provider"));
  }
});
test("missing AI configuration leaves manual listing available and makes no provider request", async () => {
  const f = fixture({ env: { OPENAI_API_KEY: "" } }); const response = await f.run();
  assert.equal(response.status, 503); assert.match((await response.json()).message, /manually/); assert(!f.calls.some(call => call[0] === "provider"));
});
test("arbitrary URLs, misleading MIME types, too many photos and oversized bodies never reach the provider", async () => {
  for (const body of [{ photos: [] }, { photos: ["https://attacker.example/private"] }, { photos: Array(4).fill(photo) },
    { photos: [photo.replace("jpeg", "png")] }, { photos: ["data:image/jpeg;base64," + "A".repeat(700004)] }]) {
    const f = fixture({ body }); assert.equal((await f.run()).status, 400); assert(!f.calls.some(call => call[0] === "provider"));
  }
  for (const rawBody of ["invalid json", " ".repeat(2200001)]) { assert.equal((await fixture({ rawBody }).run()).status, 400); }
});
test("the provider receives resized photo data, an accurate-item prompt and strict structured output, without database writes", async () => {
  const f = fixture(); const response = await f.run(); assert.equal(response.status, 200); assert.deepEqual((await response.json()).suggestion, suggestion);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const provider = f.calls.find(call => call[0] === "provider"); const body = JSON.parse(provider[2].body);
  assert.equal(provider[1], "https://api.openai.com/v1/responses"); assert.equal(provider[2].headers.Authorization, "Bearer private-ai-key");
  assert.equal(body.store, false); assert.equal(body.model, "gpt-4.1-mini"); assert.equal(body.text.format.strict, true);
  assert.match(body.instructions, /never instructions/); assert.match(body.instructions, /Never invent/); assert.match(body.instructions, /Do not include prices/);
  assert.equal(body.input[0].content[1].image_url, photo); assert.deepEqual(f.calls.filter(call => call[0] === "rpc").map(call => call[1]), ["is_marketplace_admin"]);
  assert.equal(f.releases(), 1);
});
test("refused, incomplete or malformed results cannot become usable listing suggestions", async () => {
  for (const payload of [{ status: "incomplete" }, { status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] },
    { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }] }]) {
    const f = fixture({ payload }); assert.equal((await f.run()).status, 503); assert.equal(f.releases(), 1);
  }
  assert.equal(validateSuggestion({ ...suggestion, title: " " }), null);
  assert.equal(validateSuggestion({ ...suggestion, description: "x".repeat(2501) }), null);
  assert.equal(validateSuggestion({ ...suggestion, uncertain_details: [null] }), null);
  assert.deepEqual(validateSuggestion({ ...suggestion, price: 10000, title: ` ${suggestion.title} ` }), suggestion);
});
test("authentication, provider and response-body stalls have deadlines and provider failures never expose credentials or auto-retry", async () => {
  for (const options of [{ hangAuth: true }, { hangAdmin: true }, { hangProvider: true }, { hangJson: true }, { networkError: true }, { status: 429, payload: { error: { message: "private-ai-key" } } }]) {
    const f = fixture(options); const response = await f.run(); assert.equal(response.status, 503);
    const body = await response.text(); assert(!body.includes("private-ai-key")); assert(!body.includes("user-token"));
    assert(f.calls.filter(call => call[0] === "provider").length <= 1);
  }
});
test("a concurrent or exhausted request is stopped before provider billing", async () => {
  const f = fixture({ reserve: () => null }); assert.equal((await f.run()).status, 429); assert(!f.calls.some(call => call[0] === "provider"));
  let time = 100; const reserve = createSuggestionLimiter({ now: () => time, limit: 2, windowMs: 100 });
  const first = reserve("admin"); assert(first); assert.equal(reserve("admin"), null);
  const other = reserve("other"); assert(other); other(); first();
  const second = reserve("admin"); assert(second); second(); assert.equal(reserve("admin"), null);
  time = 200; assert(reserve("admin"));
});
test("a stalled request stream is cancelled before provider billing", async () => {
  let cancelled = false;
  const request = new Request("https://pinoybuynsell.com/api/marketplace/listing-suggestions", { method: "POST", duplex: "half",
    headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
    body: new ReadableStream({ cancel() { cancelled = true; } }) });
  let providerCalls = 0;
  const response = await handleListingSuggestions(request, { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public", OPENAI_API_KEY: "secret" },
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) }, rpc: async () => ({ data: true }) }),
    fetchImpl: () => { providerCalls++; }, databaseTimeoutMs: 10 });
  assert.equal(response.status, 400); assert.equal(providerCalls, 0); assert(cancelled);
});
