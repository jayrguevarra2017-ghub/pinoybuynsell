import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { claimUSAItemPost } from "../../lib/usa-facebook-publishing.mjs";
import { usaFacebookJobId } from "../../lib/usa-item-sharing.mjs";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
const owner = "22222222-2222-4222-8222-222222222222", other = "33333333-3333-4333-8333-333333333333";
const id = "11111111-1111-4111-8111-111111111111", key = usaFacebookJobId(id);
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 create table public.marketplace_admins(user_id uuid primary key);
 create function public.is_marketplace_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.marketplace_admins where user_id=auth.uid())$$;
 create table public.products(id bigint primary key,seller_id uuid,status text,deleted_at timestamptz);
 insert into auth.users values('${owner}'),('${other}'); insert into marketplace_admins values('${owner}'),('${other}');
 insert into products values(4,'${owner}','active',null);`);
await db.exec(readFileSync(new URL("../../supabase/migrations/202610080010_facebook_listing_posts.sql", import.meta.url), "utf8"));
await db.query("insert into facebook_listing_posts(listing_id,owner_id,page_id,status,post_id) values('4',$1,'123','published','123_4')", [owner]);
const productBefore = (await db.query("select * from facebook_listing_posts where listing_id='4'")).rows;

// Supabase-shaped adapter backed by actual PostgreSQL constraints and updates.
const fields = new Set(["listing_id", "owner_id", "page_id", "status", "claim_token", "post_id", "message", "attempts", "updated_at"]);
const name = field => { assert(fields.has(field)); return `"${field}"`; };
const server = { from(table) {
  assert.equal(table, "facebook_listing_posts"); let action, values, filters = [];
  return { select() { return this; }, insert(value) { action = "insert"; values = value; return this; },
    update(value) { action = "update"; values = value; return this; }, eq(field, value) { filters.push([field, value]); return this; },
    async maybeSingle() {
      const args = [];
      const param = value => { args.push(value); return `$${args.length}`; };
      let sql;
      if (action === "insert") sql = `insert into facebook_listing_posts(${Object.keys(values).map(name).join(",")}) values(${Object.values(values).map(param).join(",")}) returning *`;
      else {
        sql = action === "update" ? `update facebook_listing_posts set ${Object.entries(values).map(([field, value]) => `${name(field)}=${param(value)}`).join(",")}` : "select * from facebook_listing_posts";
        sql += ` where ${filters.map(([field, value]) => `${name(field)}=${param(value)}`).join(" and ")}`;
        if (action === "update") sql += " returning *";
      }
      try { return { data: JSON.parse(JSON.stringify((await db.query(sql, args)).rows[0] || null)) }; }
      catch (error) { return { error: { code: error.code } }; }
    } };
} };
let checks = 0;
function equal(actual, expected) { assert.deepEqual(actual, expected); checks++; }
async function role(id = "", name = "authenticated") { await db.exec(`reset role; set role ${name}; select set_config('request.jwt.claim.sub','${id}',false);`); }
async function denied(operation) { await assert.rejects(operation); checks++; }
await role("", "service_role");
const first = await claimUSAItemPost(server, { itemId: id, userId: owner, pageId: "123" });
equal(first.claimed, true); equal(first.job.listing_id, key); equal(first.job.owner_id, owner); equal(first.job.status, "processing");
const overlapping = await claimUSAItemPost(server, { itemId: id, userId: owner, pageId: "123" });
equal(overlapping.claimed, false); equal(overlapping.job.status, "processing");
equal((await db.query("select finish_facebook_listing_post($1,$2,'published','123_5','USA item posted.') as ok", [key, first.job.claim_token])).rows[0].ok, true);
const published = await claimUSAItemPost(server, { itemId: id, userId: owner, pageId: "123" });
equal(published.claimed, false); equal(published.job.post_id, "123_5");
equal((await db.query("select * from facebook_listing_posts where listing_id='4'")).rows, productBefore);

await role(owner);
equal((await db.query("select listing_id from facebook_listing_posts order by listing_id")).rows.map(row => row.listing_id), ["4", key]);
await denied(() => db.query("update facebook_listing_posts set status='failed' where listing_id=$1", [key]));
await denied(() => db.query("insert into facebook_listing_posts(listing_id,owner_id,page_id,status) values('usa:fake',$1,'123','processing')", [owner]));
await denied(() => db.query("select finish_facebook_listing_post($1,$2,'failed',null,'forged')", [key, first.job.claim_token]));
await role(other); equal((await db.query("select * from facebook_listing_posts where listing_id=$1", [key])).rows.length, 0);
await role("", "anon"); await denied(() => db.query("select * from facebook_listing_posts where listing_id=$1", [key]));
await role("", "service_role");
await db.query("update facebook_listing_posts set status='failed',updated_at=clock_timestamp()-interval '3 minutes' where listing_id=$1", [key]);
const retry = await claimUSAItemPost(server, { itemId: id, userId: owner, pageId: "123" });
equal(retry.claimed, true); equal(retry.job.attempts, 2); assert.notEqual(retry.job.claim_token, first.job.claim_token); checks++;
equal((await db.query("select finish_facebook_listing_post($1,$2,'failed',null,'stale response') as ok", [key, first.job.claim_token])).rows[0].ok, false);
equal((await db.query("select finish_facebook_listing_post($1,$2,'failed',null,'definite rejection') as ok", [key, retry.job.claim_token])).rows[0].ok, true);
equal((await claimUSAItemPost(server, { itemId: id, userId: owner, pageId: "123" })).claimed, false);
await db.query("update facebook_listing_posts set status='processing',updated_at=clock_timestamp()-interval '3 minutes' where listing_id=$1", [key]);
const stalled = await claimUSAItemPost(server, { itemId: id, userId: owner, pageId: "123" });
equal(stalled.claimed, false); equal(stalled.job.status, "uncertain");
equal((await claimUSAItemPost(server, { itemId: id, userId: owner, pageId: "123" })).claimed, false);
equal((await db.query("select * from facebook_listing_posts where listing_id='4'")).rows, productBefore);
await db.exec(`reset role; delete from marketplace_admins where user_id='${owner}';`);
await role(owner); equal((await db.query("select * from facebook_listing_posts where listing_id=$1", [key])).rows.length, 0);
console.log(`${checks} isolated USA Facebook ledger checks passed using unchanged migration 010. No hosted writes were made.`);
await db.close();
