import test from "node:test";
import assert from "node:assert/strict";
import { canPublishListingToPage, facebookPublishingUrl, facebookPostingState, publishFacebookListing, validFacebookListingId, withFacebookDeadline } from "../lib/facebook-posting.mjs";

const product = { id: 5, seller_id: "admin", status: "active", deleted_at: null };
const client = { auth: { getSession: async () => ({ data: { session: { access_token: "user-session" } } }) } };

test("only an administrator's own active listing offers direct Page posting", () => {
  assert.equal(canPublishListingToPage(product, { id: "admin" }, true), true);
  for (const [item, user, admin] of [
    [product, null, true], [product, { id: "other-admin" }, true], [product, { id: "admin" }, false],
    [product, { id: "admin" }, "true"], [{ ...product, deleted_at: "2026-10-10" }, { id: "admin" }, true],
    [{ ...product, status: "sold" }, { id: "admin" }, true],
  ]) assert.equal(canPublishListingToPage(item, user, admin), false);
});

test("Page posting links target the requested listing and reject malformed IDs", () => {
  assert.equal(facebookPublishingUrl(5), "/admin/facebook?listing=5");
  assert(validFacebookListingId("11111111-1111-4111-8111-111111111111"));
  for (const id of ["", "5&listing=6", "https://example.com", "a".repeat(101)]) {
    assert.equal(validFacebookListingId(id), false); assert.equal(facebookPublishingUrl(id), null);
  }
});

test("direct posting makes exactly one authenticated website request and returns its result", async () => {
  let calls = 0;
  const result = await publishFacebookListing(client, "5", { fetchImpl: async (url, options) => {
    calls++; assert.equal(url, "/api/facebook/publish"); assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer user-session");
    assert.deepEqual(JSON.parse(options.body), { listingId: "5" }); assert.equal(options.cache, "no-store");
    return Response.json({ status: "published", postId: "123_456", message: "Listing posted to Facebook." });
  } });
  assert.equal(calls, 1); assert.equal(result.status, "published");
});

test("missing sessions and invalid IDs never start a publishing request", async () => {
  const fetchImpl = () => { throw Error("Unexpected publish"); };
  await assert.rejects(publishFacebookListing({ auth: { getSession: async () => ({ data: {} }) } }, "5", { fetchImpl }), /Sign in again/);
  await assert.rejects(publishFacebookListing(client, "5&listing=6", { fetchImpl }), /Invalid listing/);
});

test("a stalled session check stops before posting", async () => {
  let calls = 0;
  await assert.rejects(publishFacebookListing({ auth: { getSession: () => new Promise(() => {}) } }, "5", {
    sessionTimeoutMs: 10, fetchImpl: () => { calls++; },
  }), /timed out/);
  assert.equal(calls, 0);
});

test("a stalled response aborts and never retries an uncertain post", async () => {
  let calls = 0, signal;
  await assert.rejects(publishFacebookListing(client, "5", { timeoutMs: 10, fetchImpl: (_url, options) => {
    calls++; signal = options.signal; return new Promise(() => {});
  } }), /Check the Facebook Page/);
  assert.equal(signal.aborted, true); assert.equal(calls, 1);
});

test("reading a stalled response body also has a deadline", async () => {
  await assert.rejects(publishFacebookListing(client, "5", { timeoutMs: 10,
    fetchImpl: async () => ({ json: () => new Promise(() => {}) }),
  }), /Posting timed out/);
});

test("failed and uncertain results are returned for display without another publishing request", async () => {
  for (const status of ["failed", "uncertain"]) {
    let calls = 0;
    const result = await publishFacebookListing(client, "5", { fetchImpl: async () => {
      calls++; return Response.json({ status, message: "Check your Page before retrying." }, { status: 409 });
    } });
    assert.equal(calls, 1); assert.equal(result.status, status);
  }
});

test("stale processing becomes uncertain while published and failed records retain their status", () => {
  const now = Date.parse("2026-10-10T00:00:00Z");
  assert.equal(facebookPostingState({ status: "processing", updated_at: new Date(now - 120001).toISOString() }, now).status, "uncertain");
  assert.equal(facebookPostingState({ status: "processing", updated_at: new Date(now - 120000).toISOString() }, now).status, "processing");
  for (const status of ["published", "failed", "uncertain"]) {
    assert.equal(facebookPostingState({ status, updated_at: "2025-01-01" }, now).status, status);
  }
  assert.equal(facebookPostingState(undefined), undefined);
});

test("status checks resolve normally and bound promises that never settle", async () => {
  assert.equal(await withFacebookDeadline(Promise.resolve(true), 10), true);
  await assert.rejects(withFacebookDeadline(new Promise(() => {}), 10), /timed out/);
});
