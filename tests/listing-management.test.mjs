import test from "node:test";
import assert from "node:assert/strict";
import { canRelistListing, readRelistSource, relistListing, deleteAdminListing, readManagedListings } from "../lib/listing-management.mjs";

const owner = "11111111-1111-4111-8111-111111111111";
const path = `${owner}/22222222-2222-4222-8222-222222222222.jpg`;
const now = Date.parse("2026-10-11T00:00:00Z");
const source = { id: 4, seller_id: owner, status: "active", deleted_at: null, listing_type: "auction",
  relisted_from_id: null, relisted_to_id: null,
  quantity: 1, auction_ends_at: "2026-10-10T00:00:00Z", image_path: path,
  auctions: [{ id: 3, status: "active", starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-10T00:00:00Z", starting_price: 100, current_bid: 300 }] };

function fixture({ product = source, admin = true, authId = owner, readError = false, deletion = { id: 4, deleted_at: "2026-10-11T00:00:00Z" }, deleteError = null } = {}) {
  const calls = { reads: [], writes: [], rpc: [], uploads: 0, removes: 0 };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: authId } } }) },
    rpc: async (name, args) => { calls.rpc.push({ name, args }); return name === "is_marketplace_admin" ? { data: admin } : { data: deletion, error: deleteError }; },
    storage: { from: () => ({ upload: async () => { calls.uploads++; return {}; }, remove: async () => { calls.removes++; return {}; } }) },
    from: table => {
      assert.equal(table, "products");
      return {
        select: select => {
          const filters = {}; const query = { eq: (key, value) => { filters[key] = value; return query; },
            single: async () => { calls.reads.push({ select, filters }); return readError ? { error: { message: "Private provider detail" } } : { data: product }; },
            limit: async () => ({ data: [] }) };
          return query;
        },
        insert: values => { calls.writes.push(values); return { select: () => ({ single: async () => ({ data: { ...values, id: 20 } }) }) }; },
        update: () => { throw Error("Relisting must never update original records"); },
        delete: () => { throw Error("Deletion must use the audit-preserving RPC"); },
      };
    },
  };
  return { client, calls };
}

test("only owned ended, sold and out-of-stock listings can be relisted", () => {
  assert(canRelistListing(source, owner, now));
  assert(canRelistListing({ ...source, status: "sold" }, owner, now));
  assert(canRelistListing({ ...source, listing_type: "fixed_price", quantity: 0 }, owner, now));
  for (const product of [{ ...source, seller_id: "other" }, { ...source, deleted_at: "today" }, { ...source, relisted_to_id: 20 },
    { ...source, status: "draft" }, { ...source, auction_ends_at: null, auctions: [] },
    { ...source, auctions: [{ ...source.auctions[0], ends_at: "2030-10-10T00:00:00Z" }] },
    { ...source, listing_type: "fixed_price", quantity: 1 }]) assert.equal(canRelistListing(product, owner, now), false);
  assert.equal(canRelistListing(source, null, now), false);
});

test("source loading checks trusted admin role, current identity and database ownership filters", async () => {
  const { client, calls } = fixture();
  assert.deepEqual(await readRelistSource(client, owner, "4", now), source);
  assert.deepEqual(calls.reads[0].filters, { id: "4", seller_id: owner });
  assert(calls.reads[0].select.includes("auctions(")); assert(!calls.reads[0].select.includes("bidder_id"));
  assert.equal(calls.writes.length, 0);
});

test("non-admin, changed account, malformed ID and provider errors cannot start relisting", async () => {
  for (const options of [{ admin: false }, { authId: "other" }, { readError: true }]) {
    const { client, calls } = fixture(options);
    await assert.rejects(relistListing(client, owner, 4, {}, null));
    assert.equal(calls.writes.length, 0); assert.equal(calls.uploads, 0);
  }
  const { client, calls } = fixture();
  await assert.rejects(readRelistSource(client, owner, "4&seller_id=other"));
  assert.equal(calls.rpc.length, 0);
});

test("a source changed back to live, deleted or transferred is rejected at publish time", async () => {
  for (const product of [{ ...source, seller_id: "other" }, { ...source, id: 5 }, { ...source, deleted_at: "today" }, { ...source, relisted_to_id: 20 },
    { ...source, auctions: [{ ...source.auctions[0], ends_at: "2030-10-10T00:00:00Z" }] }]) {
    const { client, calls } = fixture({ product });
    await assert.rejects(relistListing(client, owner, 4, { quantity: 1 }, [{ path }]));
    assert.equal(calls.writes.length, 0);
  }
});

test("relisting with historical bids creates a fresh product, preserves photos and omits old/private IDs", async () => {
  const { client, calls } = fixture();
  const result = await relistListing(client, owner, 4, { title: "Relisted card", quantity: 1, listing_type: "auction",
    auction_starting_price: 150, auction_bid_increment: 60, auction_ends_at: "2030-10-10T00:00:00Z", id: 4, seller_id: "other",
    deleted_at: "today", status: "sold", auctions: source.auctions, facebook_post_id: "old-post", bidder_id: "private" }, [{ path }]);
  assert.equal(result.id, 20); assert.equal(calls.writes.length, 1);
  assert.deepEqual(calls.writes[0], { title: "Relisted card", quantity: 1, listing_type: "auction", auction_starting_price: 150,
    auction_bid_increment: 60, auction_ends_at: "2030-10-10T00:00:00Z", status: "active", seller_id: owner, image_path: path, image_paths: [path], relisted_from_id: "4" });
  assert.equal(calls.uploads, 0); assert.equal(calls.removes, 0);
  assert.equal(source.auctions[0].current_bid, 300);
});

test("relisting cannot publish empty stock or copy another seller's photos", async () => {
  const empty = fixture(); await assert.rejects(relistListing(empty.client, owner, 4, { quantity: 0 }, []), /available quantity/);
  assert.equal(empty.calls.writes.length, 0);
  const foreign = fixture(); await assert.rejects(relistListing(foreign.client, owner, 4, { quantity: 1 }, [{ path: path.replace(owner, "33333333-3333-4333-8333-333333333333") }]), /does not belong/);
  assert.equal(foreign.calls.writes.length, 0);
});

test("missing relist schema stops before photos or creating another untracked copy", async () => {
  const legacy = { ...source }; delete legacy.relisted_to_id; delete legacy.relisted_from_id;
  const { client, calls } = fixture({ product: legacy });
  await assert.rejects(relistListing(client, owner, 4, { quantity: 1 }, [{ path }]), /database update.*No new listing/);
  assert.equal(calls.writes.length, 0); assert.equal(calls.uploads, 0); assert.equal(calls.removes, 0);
});

test("an unlinked creation receipt is not reported as a successful relist", async () => {
  const { client, calls } = fixture();
  const original = client.from;
  client.from = table => ({ ...original(table), insert: values => {
    calls.writes.push(values); return { select: () => ({ single: async () => ({ data: { id: 20 } }) }) };
  } });
  await assert.rejects(relistListing(client, owner, 4, { quantity: 1 }, [{ path }]), /Could not confirm/);
  assert.equal(calls.writes.length, 1);
});

function listFixture(results) {
  const calls = [];
  return { calls, client: { from: table => {
    const call = { table, filters: {} }; calls.push(call);
    const query = { select: fields => { call.fields = fields; return query; },
      eq: (key, value) => { call.filters[key] = value; return query; },
      is: (key, value) => { call.filters[key] = value; return query; },
      order: (key, value) => { call.order = [key, value]; return query; },
      limit: value => { call.limit = value; return query; },
      then: resolve => Promise.resolve(results[calls.indexOf(call)]).then(resolve) };
    return query;
  } } };
}

test("managed lists hide replaced originals before applying a limit and expose explicit history", async () => {
  const rows = [{ ...source, relisted_to_id: 20 }, { ...source, id: 20 }];
  const normal = listFixture([{ data: rows }]);
  assert.deepEqual((await readManagedListings(normal.client, { sellerId: owner, limit: 100 })).map(row => row.id), [20]);
  assert.deepEqual(normal.calls[0].filters, { seller_id: owner, relisted_to_id: null });
  assert.equal(normal.calls[0].limit, 100);
  const history = listFixture([{ data: rows }]);
  assert.deepEqual(await readManagedListings(history.client, { includeRelisted: true }), rows);
  assert.deepEqual(history.calls[0].filters, {});
});

test("managed reads support old schema once and never mask unrelated database errors", async () => {
  const old = listFixture([{ error: { code: "42703", message: "column products.relisted_to_id does not exist" } }, { data: [source] }]);
  assert.deepEqual(await readManagedListings(old.client), [source]);
  assert.equal(old.calls.length, 2); assert.deepEqual(old.calls[1].filters, {});
  for (const error of [{ code: "42501", message: "permission denied" }, { code: "42703", message: "column unrelated does not exist" }]) {
    const denied = listFixture([{ error }]);
    await assert.rejects(readManagedListings(denied.client), /Could not load/);
    assert.equal(denied.calls.length, 1);
  }
});

test("delete uses the existing admin RPC with a trimmed audit reason and validates the receipt", async () => {
  const { client, calls } = fixture();
  const result = await deleteAdminListing(client, 4, "  Item no longer available  ");
  assert.equal(result.id, 4); assert.deepEqual(calls.rpc[1], { name: "admin_delete_listing", args: { p_listing_id: "4", p_reason: "Item no longer available" } });
  assert.equal(calls.writes.length, 0); assert.equal(calls.removes, 0);
});

test("invalid reasons, IDs and non-admins never invoke the delete RPC", async () => {
  const { client, calls } = fixture();
  for (const [id, reason] of [[4, " "], [4, "x".repeat(501)], ["bad", "Reason"]]) await assert.rejects(deleteAdminListing(client, id, reason));
  assert.equal(calls.rpc.length, 0);
  const denied = fixture({ admin: false }); await assert.rejects(deleteAdminListing(denied.client, 4, "Reason"));
  assert(denied.calls.rpc.every(call => call.name === "is_marketplace_admin"));
});

test("unknown deletion results cannot be presented as success or automatically retried", async () => {
  for (const deletion of [null, { id: 99, deleted_at: "2026-10-11" }, { id: 4, deleted_at: "invalid" }]) {
    const { client, calls } = fixture({ deletion });
    await assert.rejects(deleteAdminListing(client, 4, "Reason"), /Could not confirm/);
    assert.equal(calls.rpc.filter(call => call.name === "admin_delete_listing").length, 1);
  }
  const missing = fixture({ deleteError: { code: "PGRST202" } });
  await assert.rejects(deleteAdminListing(missing.client, 4, "Reason"), /database setup/);
});
