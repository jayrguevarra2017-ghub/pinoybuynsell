import test from "node:test";
import assert from "node:assert/strict";
import { claimUSAItemPost, handleUSAItemPublish } from "../lib/usa-facebook-publishing.mjs";
import { usaFacebookJobId, usaItemUrl } from "../lib/usa-item-sharing.mjs";

const id = "11111111-1111-4111-8111-111111111111", owner = "22222222-2222-4222-8222-222222222222";
const item = { id, admin_id: owner, title: "Nike sneakers", description: "A selected US item.", item_url: "https://www.nike.com/t/shoes", store: "Nike", usd_price: 25, status: "published", image_path: `${owner}/33333333-3333-4333-8333-333333333333.jpg` };
function fixture(options = {}) {
  let reads = 0, adminReads = 0;
  const rows = new Map(), calls = [], finished = [], meta = [];
  if (options.job) rows.set(usaFacebookJobId(id), { listing_id: usaFacebookJobId(id), owner_id: owner, page_id: "123", claim_token: "old-token", updated_at: new Date(Date.now() - 180000).toISOString(), attempts: 1, ...options.job });
  const client = { auth: { getUser: async () => options.hangAuth ? new Promise(() => {}) : options.authError ? { error: {} } : { data: { user: { id: owner } } } },
    rpc: async () => { adminReads++; return { data: options.admin !== false && !(options.revoke && adminReads > 1), error: options.adminError }; },
    from(table) {
      assert.equal(table, "usa_shopping_items"); const filters = [];
      return { select() { return this; }, eq(key, value) { filters.push([key, value]); return this; }, async maybeSingle() {
        reads++; calls.push(["item", filters]);
        return { data: options.item === null ? null : { ...item, ...options.item, ...(reads > 1 ? options.latest : {}) }, error: options.itemError };
      } };
    } };
  const server = { from(table) {
    assert.equal(table, "facebook_listing_posts"); let action = "read", values, filters = [];
    return { select() { return this; }, eq(key, value) { filters.push([key, value]); return this; },
      insert(value) { action = "insert"; values = value; return this; }, update(value) { action = "update"; values = value; return this; },
      async maybeSingle() {
        calls.push([action, values, filters]);
        if (options.hangLedger) return new Promise(() => {});
        if (action === "insert") {
          if (options.insertError) return { error: { code: "transport" } };
          if (rows.has(values.listing_id)) return { error: { code: "23505" } };
          rows.set(values.listing_id, { attempts: 1, ...values });
          return { data: { ...rows.get(values.listing_id) } };
        }
        const row = [...rows.values()].find(row => filters.every(([key, value]) => row[key] === value));
        if (!row || (action === "update" && options.loseClaim)) return { data: null };
        if (action === "update") Object.assign(row, values);
        return { data: { ...row } };
      } };
  }, rpc: async (name, values) => {
    assert.equal(name, "finish_facebook_listing_post"); finished.push(values);
    const job = rows.get(values.p_listing_id);
    if (options.saveError || !job || job.claim_token !== values.p_claim_token) return { data: false };
    Object.assign(job, { status: values.p_status, post_id: values.p_post_id, message: values.p_message }); return { data: true };
  }, storage: { from: bucket => { assert.equal(bucket, "listing-photos"); return { getPublicUrl: path => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}` } }) }; } } };
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service-secret", FACEBOOK_PAGE_ID: "123", FACEBOOK_PAGE_ACCESS_TOKEN: "page-secret", ...options.env };
  return { rows, calls, finished, meta, server, async run() {
    const request = new Request("https://pinoybuynsell.com/api/facebook/usa/publish", { method: "POST", headers: options.noAuth ? {} : { Authorization: "Bearer user-token" }, body: options.body || JSON.stringify({ itemId: id, title: "untrusted title", photo: "https://evil.invalid/private", caption: "untrusted caption" }) });
    return handleUSAItemPublish(request, { env, createClient: (_url, key) => key === env.SUPABASE_SERVICE_ROLE_KEY ? server : client, databaseTimeoutMs: options.deadline || 8000,
      fetchImpl: async (url, request) => {
        meta.push([url, request]);
        if (options.networkError) throw Error("page-secret");
        return Response.json(options.graph || { id: "456", post_id: "123_456" }, { status: options.graphStatus || 200 });
      } });
  } };
}

test("USA Page publishing rejects guests, invalid sessions and non-admins without writes", async () => {
  for (const [options, status] of [[{ noAuth: true }, 401], [{ authError: true }, 401], [{ admin: false }, 403], [{ adminError: {} }, 403]]) {
    const f = fixture(options); assert.equal((await f.run()).status, status); assert.equal(f.meta.length, 0); assert.equal(f.rows.size, 0);
  }
});
test("USA Page publishing validates body, ownership, visibility, source and public photo", async () => {
  for (const body of ["not json", JSON.stringify({ itemId: "4" }), JSON.stringify({ listingId: "1" })]) {
    const f = fixture({ body }); assert.equal((await f.run()).status, 400); assert.equal(f.meta.length, 0);
  }
  for (const invalid of [null, { admin_id: "other" }, { status: "draft" }, { status: "archived" }, { item_url: "https://nike.com.evil.invalid/item" }, { store: "Amazon" }, { image_path: "identity-documents/private.jpg" }, { image_path: `other/${id}.jpg` }, { id: owner }]) {
    const f = fixture({ item: invalid }); assert.equal((await f.run()).status, 403); assert.equal(f.meta.length, 0); assert.equal(f.rows.size, 0);
    assert(f.calls.some(([type, filters]) => type === "item" && filters.some(([key, value]) => key === "admin_id" && value === owner)));
  }
});
test("USA publisher fails safely before Meta when configuration, item read or reservation is unavailable", async () => {
  for (const options of [{ env: { SUPABASE_SERVICE_ROLE_KEY: "" } }, { env: { FACEBOOK_PAGE_ID: "../other" } }, { env: { FACEBOOK_GRAPH_API_VERSION: "bad" } }, { itemError: {} }, { insertError: true }]) {
    const f = fixture(options); assert.equal((await f.run()).status, 503); assert.equal(f.meta.length, 0);
  }
});
test("a USA post uses saved details/photo, reference USD price and website link with no client caption or private fields", async () => {
  const f = fixture({ item: { private_notes: "private address", contact_name: "secret customer" } });
  const response = await f.run(); assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.status, "published"); assert.equal(result.postId, "123_456"); assert.equal(f.meta.length, 1);
  const [url, request] = f.meta[0], parameters = new URLSearchParams(request.body);
  assert.equal(url, "https://graph.facebook.com/v26.0/123/photos"); assert.equal(request.headers.Authorization, "Bearer page-secret");
  assert.equal(parameters.get("url"), `https://example.supabase.co/storage/v1/object/public/listing-photos/${item.image_path}`);
  const caption = parameters.get("caption");
  for (const text of [item.title, item.description, "$25.00 USD", "quoted separately", usaItemUrl(id), "#Nike", "#USAtoPhilippines", "#PinoyBuyNSell"]) assert(caption.includes(text), text);
  for (const text of ["untrusted", "secret customer", "private address", "page-secret", "service-secret", "₱"]) assert(!caption.includes(text), text);
  assert.equal(f.finished[0].p_listing_id, usaFacebookJobId(id)); assert.equal(f.finished[0].p_status, "published");
});
test("published, processing, uncertain and recent failed USA jobs cannot create another post", async () => {
  for (const status of ["published", "processing", "uncertain", "failed"]) {
    const f = fixture({ job: { status, post_id: status === "published" ? "123_456" : null, updated_at: new Date().toISOString() } });
    assert.equal((await f.run()).status, status === "published" ? 200 : 409); assert.equal(f.meta.length, 0);
  }
});
test("stalled initial publication becomes uncertain rather than silently retrying", async () => {
  const f = fixture({ job: { status: "processing" } });
  assert.equal((await f.run()).status, 409); assert.equal(f.rows.get(usaFacebookJobId(id)).status, "uncertain"); assert.equal(f.meta.length, 0);
});
test("only a definite failed USA post can be conditionally reserved again after the cooldown", async () => {
  const f = fixture({ job: { status: "failed" } }); assert.equal((await f.run()).status, 200); assert.equal(f.meta.length, 1);
  const update = f.calls.find(([action]) => action === "update");
  for (const field of ["listing_id", "owner_id", "status", "claim_token", "updated_at"]) assert(update[2].some(([key]) => key === field), field);
  assert.equal(f.rows.get(usaFacebookJobId(id)).attempts, 2);
  const lost = fixture({ job: { status: "failed" }, loseClaim: true }); assert.equal((await lost.run()).status, 409); assert.equal(lost.meta.length, 0);
});
test("two simultaneous first posts or retries produce at most one Meta request", async () => {
  for (const options of [{}, { job: { status: "failed" } }]) {
    const f = fixture(options); await Promise.all([f.run(), f.run()]); assert.equal(f.meta.length, 1); assert.equal(f.rows.size, 1);
  }
});
test("ownership or visibility changes and revoked admin access are rechecked after reservation", async () => {
  for (const options of [{ latest: { status: "archived" } }, { latest: { admin_id: "other" } }, { revoke: true }]) {
    const f = fixture(options); assert.equal((await f.run()).status, 409); assert.equal(f.meta.length, 0); assert.equal(f.finished[0].p_status, "failed");
  }
});
test("latest saved item details, rather than the first read, are used for the caption", async () => {
  const f = fixture({ latest: { title: "Fresh Nike item", usd_price: 39 } }); assert.equal((await f.run()).status, 200);
  const caption = new URLSearchParams(f.meta[0][1].body).get("caption"); assert(caption.includes("Fresh Nike item")); assert(caption.includes("$39.00 USD"));
});
test("Meta rejections remain retryable but network/server failures remain uncertain, with no credential leaks", async () => {
  for (const [options, expected] of [
    [{ graph: { error: { code: 190, message: "page-secret" } }, graphStatus: 400 }, "failed"],
    [{ graph: { error: { code: 200, message: "service-secret" } }, graphStatus: 403 }, "failed"],
    [{ graph: { error: { code: 368, error_user_msg: "page-secret" } }, graphStatus: 400 }, "failed"],
    [{ graph: { error: { message: "page-secret" } }, graphStatus: 500 }, "uncertain"],
    [{ networkError: true }, "uncertain"], [{ graph: {} }, "uncertain"], [{ saveError: true }, "uncertain"],
  ]) {
    const f = fixture(options), result = await (await f.run()).json(); assert.equal(result.status, expected); assert.equal(f.meta.length, 1);
    for (const secret of ["page-secret", "service-secret", "user-token"]) assert(!JSON.stringify(result).includes(secret));
  }
});
test("database and authentication deadlines cannot leave an indefinitely loading USA publish response", async () => {
  for (const options of [{ hangAuth: true }, { hangLedger: true }]) {
    const f = fixture({ ...options, deadline: 5 }); assert.equal((await f.run()).status, 503); assert.equal(f.meta.length, 0);
  }
});
test("invalid USA reservation keys cannot write into the product publishing namespace", async () => {
  const f = fixture(); await assert.rejects(claimUSAItemPost(f.server, { itemId: "4", userId: owner, pageId: "123" })); assert.equal(f.rows.size, 0);
});
