import test from "node:test";
import assert from "node:assert/strict";
import { canRelistListing, readRelistSource, relistListing, deleteAdminListing } from "../lib/listing-management.mjs";

const owner = "11111111-1111-4111-8111-111111111111";
const path = `${owner}/22222222-2222-4222-8222-222222222222.jpg`;
const now = Date.parse("2026-10-11T00:00:00Z");
const source = { id: 4, seller_id: owner, status: "active", deleted_at: null, listing_type: "auction",
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
  for (const product of [{ ...source, seller_id: "other" }, { ...source, deleted_at: "today" },
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
  for (const product of [{ ...source, seller_id: "other" }, { ...source, id: 5 }, { ...source, deleted_at: "today" },
    { ...source, auctions: [{ ...source.auctions[0], ends_at: "2030-10-10T00:00:00Z" }] }]) {
    const { client, calls } = fixture({ product });
    await assert.rejects(relistListing(client, owner, 4, { quantity: 1 }, [{ path }]));
    assert.equal(calls.writes.length, 0);
  }
});

test("relisting with historical bids creates a fresh product, preserves photos and omits old/private IDs", async () => {
  const { client, calls } = fixture();
  const result = await relistListing(client, owner, 4, { title: "Relisted card", quantity: 1, listing_type: "auction",
    auction_starting_price: 150, auction_ends_at: "2030-10-10T00:00:00Z", id: 4, seller_id: "other",
    deleted_at: "today", status: "sold", auctions: source.auctions, facebook_post_id: "old-post", bidder_id: "private" }, [{ path }]);
  assert.equal(result.id, 20); assert.equal(calls.writes.length, 1);
  assert.deepEqual(calls.writes[0], { title: "Relisted card", quantity: 1, listing_type: "auction", auction_starting_price: 150,
    auction_ends_at: "2030-10-10T00:00:00Z", status: "active", seller_id: owner, image_path: path, image_paths: [path] });
  assert.equal(calls.uploads, 0); assert.equal(calls.removes, 0);
  assert.equal(source.auctions[0].current_bid, 300);
});

test("relisting cannot publish empty stock or copy another seller's photos", async () => {
  const empty = fixture(); await assert.rejects(relistListing(empty.client, owner, 4, { quantity: 0 }, []), /available quantity/);
  assert.equal(empty.calls.writes.length, 0);
  const foreign = fixture(); await assert.rejects(relistListing(foreign.client, owner, 4, { quantity: 1 }, [{ path: path.replace(owner, "33333333-3333-4333-8333-333333333333") }]), /does not belong/);
  assert.equal(foreign.calls.writes.length, 0);
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
