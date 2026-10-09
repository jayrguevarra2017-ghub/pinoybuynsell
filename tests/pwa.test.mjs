import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { appPlatform, installedDisplay, mobileLinkActive } from "../lib/app-install.mjs";

const workerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
function worker({ fetchImpl = async () => new Response("Current server page"), cached = new Response("Offline screen") } = {}) {
  const handlers = {}, added = [], removed = [], matched = [], fetched = [];
  let claimed = false, skipped = false;
  const cache = { addAll: async paths => added.push(...paths) };
  const caches = { open: async () => cache, keys: async () => ["pinoybuynsell-offline-v1", "pinoybuynsell-offline-old", "other-app-cache"],
    delete: async key => { removed.push(key); return true; }, match: async path => { matched.push(path); return cached; } };
  vm.runInNewContext(workerSource, { URL, Response, caches, fetch: async (...args) => { fetched.push(args); return fetchImpl(...args); },
    self: { location: { origin: "https://pinoybuynsell.com" }, addEventListener: (event, handler) => { handlers[event] = handler; },
      skipWaiting: async () => { skipped = true; }, clients: { claim: async () => { claimed = true; } } } });
  return { added, removed, matched, fetched,
    get claimed() { return claimed; }, get skipped() { return skipped; },
    async lifecycle(event) { let promise; handlers[event]({ waitUntil: p => { promise = p; } }); await promise; },
    request(url, method = "GET", mode = "cors") { let response; handlers.fetch({ request: { url, method, mode }, respondWith: p => { response = p; } }); return response; },
  };
}

test("app manifest uses a stable identity and the real logo dimensions", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.id, "/"); assert.equal(manifest.scope, "/"); assert.equal(manifest.display, "standalone");
  assert.equal(new URL(manifest.start_url, "https://pinoybuynsell.com").origin, "https://pinoybuynsell.com");
  for (const icon of manifest.icons) {
    const png = await readFile(new URL(`../public${icon.src}`, import.meta.url));
    assert.equal(icon.sizes, `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
    assert(png.readUInt32BE(16) >= 512); assert.equal(icon.purpose, "any");
  }
  assert(manifest.icons.some(icon => Number(icon.sizes.split("x")[0]) <= 1024));
});

test("offline installation stores only static shell assets, not marketplace or account pages", async () => {
  const app = worker(); await app.lifecycle("install");
  assert.deepEqual(app.added, ["/offline.html", "/branding/pinoybuynsell-facebook-profile.png"]);
  assert.equal(app.skipped, true);
});

test("updates remove only this app's outdated offline caches", async () => {
  const app = worker(); await app.lifecycle("activate");
  assert.deepEqual(app.removed, ["pinoybuynsell-offline-old"]); assert.equal(app.claimed, true);
});

test("online public and private navigations always use the live server and never store HTML", async () => {
  const app = worker();
  for (const path of ["/product/4", "/account", "/admin/verifications", "/sell"]) {
    const response = await app.request(`https://pinoybuynsell.com${path}`, "GET", "navigate");
    assert.equal(await response.text(), "Current server page");
  }
  assert.equal(app.fetched.length, 4); assert(app.fetched.every(args => args[1].cache === "no-store"));
  assert.equal(app.added.length, 0); assert.equal(app.matched.length, 0);
});

test("offline navigation shows a neutral reconnect screen without exposing cached account data", async () => {
  const app = worker({ fetchImpl: async () => { throw Error("Offline"); } });
  const response = await app.request("https://pinoybuynsell.com/account", "GET", "navigate");
  assert.equal(await response.text(), "Offline screen");
  assert.deepEqual(app.matched, ["/offline.html"]); assert.deepEqual(app.added, []);
  const empty = worker({ fetchImpl: async () => { throw Error("Offline"); }, cached: null });
  const fallback = await empty.request("https://pinoybuynsell.com/", "GET", "navigate");
  assert.equal(fallback.status, 503);
});

test("API calls, bids, auth, uploads, private IDs and RSC requests bypass offline interception", () => {
  const app = worker();
  for (const [url, method, mode] of [
    ["https://pinoybuynsell.com/api/facebook/publish", "POST", "cors"],
    ["https://pinoybuynsell.com/api/session", "GET", "navigate"],
    ["https://example.supabase.co/rest/v1/rpc/place_marketplace_bid", "POST", "cors"],
    ["https://example.supabase.co/auth/v1/token", "POST", "cors"],
    ["https://example.supabase.co/storage/v1/object/sign/identity-documents/id.jpg", "GET", "cors"],
    ["https://example.supabase.co/storage/v1/object/listing-photos/new.jpg", "POST", "cors"],
    ["https://pinoybuynsell.com/account?_rsc=123", "GET", "cors"],
    ["https://pinoybuynsell.com/offline.html?token=123", "GET", "cors"],
  ]) assert.equal(app.request(url, method, mode), undefined);
  assert.deepEqual(app.added, []); assert.deepEqual(app.fetched, []); assert.deepEqual(app.matched, []);
});

test("phone installation guidance detects iPad desktop mode and does not mistake desktop for iOS", () => {
  assert.equal(appPlatform({ userAgent: "iPhone Safari" }), "ios");
  assert.equal(appPlatform({ userAgent: "Macintosh Safari", maxTouchPoints: 5 }), "ios");
  assert.equal(appPlatform({ userAgent: "Macintosh Safari", maxTouchPoints: 0 }), "desktop");
  assert.equal(appPlatform({ userAgent: "Android Chrome" }), "android");
});

test("installation detection respects Safari standalone mode and ordinary browser fullscreen", () => {
  assert.equal(installedDisplay({ matchMedia: () => ({ matches: false }) }, { standalone: true }), true);
  assert.equal(installedDisplay({ matchMedia: query => ({ matches: query === "(display-mode: standalone)" }) }, {}), true);
  assert.equal(installedDisplay({ matchMedia: query => ({ matches: query === "(display-mode: fullscreen)" }) }, {}), false);
});

test("mobile navigation marks exact sections and account verification routes", () => {
  assert.equal(mobileLinkActive("/account/listings/4/edit", "/account"), true);
  assert.equal(mobileLinkActive("/verify", "/account"), true);
  assert.equal(mobileLinkActive("/product/4", "/"), false);
  assert.equal(mobileLinkActive("/searching", "/search"), false);
});
