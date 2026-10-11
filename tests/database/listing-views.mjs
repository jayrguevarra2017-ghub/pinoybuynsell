// Isolated PostgreSQL checks. Never writes hosted browsing/customer records.
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite(); let checks = 0;
await db.exec(`create role anon; create role authenticated; create role service_role;
grant usage on schema public to anon,authenticated,service_role;
create table public.products(id bigint primary key,status text,deleted_at timestamptz);
alter table products enable row level security;
insert into products values(1,'active',null),(2,'sold',null),(3,'draft',null),(4,'active',now()),(5,'active',null);`);
await db.exec(readFileSync(new URL("../../supabase/migrations/202610110019_listing_view_counts.sql", import.meta.url), "utf8"));
const same = (a, b) => { assert.deepEqual(a, b); checks++; };
const value = async sql => (await db.query(sql)).rows[0].v;
const role = async name => db.exec(`reset role; set role ${name};`);
const fails = async (sql, pattern) => { await assert.rejects(() => db.exec(sql), pattern); checks++; };
const a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222";
const record = (id, visitor = a) => `select record_marketplace_listing_view(${id},'${visitor}') v`;

await role("anon");
same(await value("select marketplace_listing_view_counts(array[1,2,3,4,999,1]::bigint[]) v"), [
 { listing_id: "1", view_count: "0" }, { listing_id: "2", view_count: "0" }
]);
same(await value(record(1)), { listing_id: "1", view_count: "1" });
same(await value(record(1)), { listing_id: "1", view_count: "1" });
same(await value(record(1, b)), { listing_id: "1", view_count: "2" });
same(await value(record(2)), { listing_id: "2", view_count: "1" });
for (const id of [3, 4, 999]) await fails(record(id), /unavailable/);
for (const id of [0, -1, "null"]) await fails(record(id), /Invalid listing view/);
await fails("select record_marketplace_listing_view(1,null)", /Invalid listing view/);
await fails("select record_marketplace_listing_view(1,'not-a-uuid')", /uuid/);
for (const ids of ["null", "array[null]::bigint[]", "array[-1]::bigint[]", "array[0]::bigint[]", "array(select generate_series(1,101))::bigint[]"])
 await fails(`select marketplace_listing_view_counts(${ids})`, /Invalid listing selection/);
same(await value("select marketplace_listing_view_counts('{}'::bigint[]) v"), []);

for (const name of ["anon", "authenticated"]) {
 await role(name);
 for (const table of ["marketplace_listing_view_totals", "marketplace_listing_view_days"]) {
  await fails(`select * from ${table}`, /permission denied/);
  await fails(`delete from ${table}`, /permission denied/);
 }
 await fails("insert into marketplace_listing_view_totals values(5,999)", /permission denied/);
 await fails("update marketplace_listing_view_totals set view_count=999", /permission denied/);
 same(await value(record(1)), { listing_id: "1", view_count: "2" });
}
await db.exec("reset role");
same(await value("select bool_and(relrowsecurity) v from pg_class where relname in ('marketplace_listing_view_totals','marketplace_listing_view_days')"), true);
same(await value("select count(*)::int v from marketplace_listing_view_days where listing_id=1"), 2);
same(await value(`select count(distinct visitor_hash)::int v from marketplace_listing_view_days where listing_id in (1,2)`), 3);
same(await value(`select count(*)::int v from marketplace_listing_view_days where visitor_hash='${a}'`), 0);
same(await value("select min(day)=(now() at time zone 'Asia/Manila')::date v from marketplace_listing_view_days"), true);

// A new Philippine calendar day counts again; expiring hashes never removes totals.
await db.exec("update marketplace_listing_view_days set day=day-1 where listing_id=1;");
await role("anon"); same(await value(record(1)), { listing_id: "1", view_count: "3" });
await db.exec("reset role; update marketplace_listing_view_days set day=day-40 where listing_id=1;");
await role("anon"); same(await value(record(1)), { listing_id: "1", view_count: "4" });
await db.exec("reset role");
same(await value("select count(*)::int v from marketplace_listing_view_days where listing_id=1"), 1);
same(await value("select view_count::text v from marketplace_listing_view_totals where listing_id=1"), "4");

// A failed transaction rolls back both deduplication and increment together.
await db.exec("begin; set local role anon;");
same(await value(record(5)), { listing_id: "5", view_count: "1" });
await db.exec("rollback;");
same(await value("select count(*)::int v from marketplace_listing_view_totals where listing_id=5"), 0);
same(await value("select count(*)::int v from marketplace_listing_view_days where listing_id=5"), 0);

// Soft-hidden listings disappear from aggregates; hard deletion cleans both tables.
await db.exec("update products set deleted_at=now() where id=1;");
await role("anon"); same(await value("select marketplace_listing_view_counts(array[1,2]::bigint[]) v"), [{ listing_id: "2", view_count: "1" }]);
await fails(record(1), /unavailable/);
await db.exec("reset role; delete from products where id=2;");
same(await value("select count(*)::int v from marketplace_listing_view_totals where listing_id=2"), 0);
same(await value("select count(*)::int v from marketplace_listing_view_days where listing_id=2"), 0);
await db.close();
console.log(`${checks} isolated listing-view SQL checks passed.`);
