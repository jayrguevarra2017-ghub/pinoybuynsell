import test from "node:test";
import assert from "node:assert/strict";
import { handleFacebookPublish, facebookCaption, facebookRejectionMessage } from "../lib/facebook-publishing.mjs";

const product = { id: 1, seller_id: "admin", title: "Test item", price: 100, status: "active", description: "Item details",
  location: "Cavite", condition: "Used", shipping_carrier: "LBC", shipping_fee: 50 };
function fixture(options = {}) {
  const calls = [], finished = [];
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
    SUPABASE_SERVICE_ROLE_KEY: "server-secret", FACEBOOK_PAGE_ID: "1286818197857823", FACEBOOK_PAGE_ACCESS_TOKEN: "page-secret", FACEBOOK_GRAPH_API_VERSION: "v26.0", ...options.env };
  const query = { select() { return this; }, eq(field, value) { calls.push([field, value]); return this; },
    async maybeSingle() { return { data: options.product === null ? null : { ...product, ...options.product }, error: null }; } };
  const user = { auth: { getUser: async () => options.hangAuth ? new Promise(() => {}) : options.authError ? { error: {} } : { data: { user: { id: "admin" } } } },
    rpc: async () => ({ data: options.admin ?? true }), from: () => query };
  const server = { rpc: async (name, values) => {
    calls.push([name, values]);
    if (name === "claim_facebook_listing_post") return options.hangClaim ? new Promise(() => {}) : { data: options.job || { status: "processing", claim_token: "claim", product: { ...product, ...options.product } } };
    finished.push(values); return options.hangFinish ? new Promise(() => {}) : { data: true, error: options.saveError ? {} : null };
  }, storage: { from: bucket => ({ getPublicUrl: path => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}` } }) }) } };
  const createClient = (_url, key) => key === env.SUPABASE_SERVICE_ROLE_KEY ? server : user;
  let requests = 0;
  const fetchImpl = async (url, request) => {
    requests++; calls.push([url, request]);
    if (options.networkError) throw new Error("page-secret network failure");
    return Response.json(options.graph || { id: "1286818197857823_123" }, { status: options.graphStatus || 200 });
  };
  const request = new Request("https://pinoybuynsell.com/api/facebook/publish", { method: "POST",
    headers: options.noAuth ? {} : { Authorization: "Bearer user-token" }, body: JSON.stringify({ listingId: "1" }) });
  return { run: () => handleFacebookPublish(request, { env, createClient, fetchImpl, databaseTimeoutMs: options.databaseTimeoutMs ?? 8000 }), calls, finished, requests: () => requests };
}

test("anonymous, invalid sessions and regular sellers cannot post", async () => {
  for (const [options, status] of [[{ noAuth: true }, 401], [{ authError: true }, 401], [{ admin: false }, 403]]) {
    const f = fixture(options); assert.equal((await f.run()).status, status); assert.equal(f.requests(), 0);
  }
});
test("only active listings owned by the signed-in administrator are queried and posted", async () => {
  for (const item of [null, { seller_id: "another-seller" }, { deleted_at: "2026-10-08" }, { status: "sold" }]) {
    const f = fixture({ product: item }); assert.equal((await f.run()).status, 403); assert.equal(f.requests(), 0);
    assert.ok(f.calls.some(([field, value]) => field === "seller_id" && value === "admin"));
  }
});
test("missing server credentials cannot publish", async () => {
  const f = fixture({ env: { SUPABASE_SERVICE_ROLE_KEY: "" } }); assert.equal((await f.run()).status, 503); assert.equal(f.requests(), 0);
});
test("an admin post uses the configured Page and includes price, shipping and listing URL", async () => {
  const f = fixture(); const r = await f.run(); assert.equal(r.status, 200); assert.equal(f.requests(), 1);
  const [url, request] = f.calls.find(([name]) => name.startsWith("https://graph.facebook.com"));
  assert.equal(url, "https://graph.facebook.com/v26.0/1286818197857823/feed");
  assert.equal(request.headers.Authorization, "Bearer page-secret");
  assert.ok(!url.includes("secret")); assert.ok(!request.body.includes("secret"));
  const body = new URLSearchParams(request.body);
  assert.equal(body.get("link"), "https://pinoybuynsell.com/product/1");
  assert.match(body.get("message"), /LBC.*₱50\.00/);
  assert.equal(f.finished[0].p_status, "published"); assert.equal(f.finished[0].p_post_id, "1286818197857823_123");
});
test("a listing photo is posted with a caption and returned feed post ID", async () => {
  const f = fixture({ product: { image_path: "admin/photo.jpg" }, graph: { id: "456", post_id: "1286818197857823_456" } });
  assert.equal((await f.run()).status, 200);
  const [url, request] = f.calls.find(([name]) => name.startsWith("https://graph.facebook.com"));
  assert.ok(url.endsWith("/photos")); const body = new URLSearchParams(request.body);
  assert.ok(body.get("url").startsWith("https://example.supabase.co/storage/v1/object/public/listing-photos/"));
  assert.ok(body.get("caption").includes("https://pinoybuynsell.com/product/1"));
  assert.equal(f.finished[0].p_post_id, "1286818197857823_456");
});
test("published, processing and uncertain jobs never send another Meta request", async () => {
  for (const status of ["published", "processing", "uncertain", "failed"]) {
    const f = fixture({ job: { status, post_id: status === "published" ? "123" : null } });
    assert.equal((await f.run()).status, status === "published" ? 200 : 409); assert.equal(f.requests(), 0);
  }
});
test("provider failures are safe to show and distinguish definite rejection from unknown outcomes", async () => {
  const cases = [
    [{ graph: { error: { code: 190, message: "page-secret" } }, graphStatus: 400 }, "failed"],
    [{ graph: { error: { code: 200, message: "page-secret" } }, graphStatus: 403 }, "failed"],
    [{ graph: { error: { message: "page-secret" } }, graphStatus: 500 }, "uncertain"],
    [{ networkError: true }, "uncertain"],
    [{ graph: {} }, "uncertain"],
  ];
  for (const [options, status] of cases) {
    const f = fixture(options); const response = await f.run(); const body = await response.text();
    assert.equal(f.finished[0].p_status, status); assert.ok(!body.includes("page-secret"));
    assert.equal(f.requests(), 1);
  }
});
test("a published post with an unsaved result is reported as uncertain", async () => {
  const f = fixture({ saveError: true }); const response = await f.run();
  assert.equal(response.status, 503); assert.equal((await response.json()).status, "uncertain");
});
test("caption has no account IDs and bounds listing text", () => {
  const caption = facebookCaption({ ...product, title: "a".repeat(1000), description: "b".repeat(10000) });
  assert.ok(caption.length < 2200); assert.ok(!caption.includes("seller_id"));
});

test("hanging authorization or database claims return without posting to Meta", async () => {
  for (const options of [{ hangAuth: true }, { hangClaim: true }]) {
    const f = fixture({ ...options, databaseTimeoutMs: 10 });
    const response = await f.run(); assert.equal(response.status, 503); assert.equal(f.requests(), 0);
  }
});

test("a hanging result save cannot leave the HTTP request pending or cause another Meta post", async () => {
  const f = fixture({ hangFinish: true, databaseTimeoutMs: 10 });
  const response = await f.run(); assert.equal(response.status, 503); assert.equal(f.requests(), 1);
  assert.match((await response.json()).message, /check Facebook/i);
});

test("Meta errors give specific safe guidance without echoing raw provider details", () => {
  for (const [code, pattern] of [[190, /token/], [200, /pages_manage_posts/], [10, /Page access/], [324, /photo/], [368, /Account Status/], [613, /limit/], [100, /error 100/]]) {
    const message = facebookRejectionMessage({ code, message: "page-secret private-provider-response" });
    assert.match(message, pattern); assert(!message.includes("secret")); assert(!message.includes("private-provider-response"));
  }
  assert(!facebookRejectionMessage({ code: "<script>alert(1)</script>" }).includes("<script>"));
});
