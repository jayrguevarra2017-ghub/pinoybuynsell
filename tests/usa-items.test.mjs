import test from "node:test";
import assert from "node:assert/strict";
import { usaItemValues, usaStores, usaStoreLink, usaQuoteSelection, usaSignInReturn } from "../lib/usa-items.mjs";
const id = "11111111-1111-4111-8111-111111111111";
const path = `${id}/22222222-2222-4222-8222-222222222222.jpg`;
const form = { title: "Selected collectible", item_url: "https://www.amazon.com/dp/ABC?tag=sample", description: "An item chosen by the administrator.", usd_price: "24.99", status: "published" };

test("retailer links accept supported exact/subdomains and preserve item parameters", () => {
  for (const store of usaStores) {
    assert.equal(usaStoreLink(`https://${store.domain}/item?a=1`).name, store.name);
    assert.equal(usaStoreLink(`https://www.${store.domain}/item?a=1`).href, `https://www.${store.domain}/item?a=1`);
  }
  assert.equal(usaStoreLink("https://WWW.AMAZON.COM/dp/ABC").name, "Amazon");
});
test("retailer links reject impersonating domains, credentials, unsafe schemes and controls", () => {
  for (const link of ["http://amazon.com/item", "https://amazon.com.evil.com/item", "https://evilamazon.com/item", "https://amazon.com@evil.com/item", "https://user@amazon.com/item", "https://amazon.com:8080/item", "javascript:alert(1)", "https://localhost/item", "https://amazon.com/with space", "https://amazon.com/\nitem", "https://amazon.com/\\item", "https://example.com/item", "https://amazon.com/" + "x".repeat(2000)]) assert.equal(usaStoreLink(link), null);
});
test("item validation allows drafts without photos and optional/zero prices", () => {
  assert.equal(usaItemValues(form, path).usd_price, 24.99);
  assert.equal(usaItemValues({ ...form, usd_price: "" }, path).usd_price, null);
  assert.equal(usaItemValues({ ...form, usd_price: "0" }, path).usd_price, 0);
  assert.equal(usaItemValues({ ...form, status: "draft" }, null).image_path, null);
  assert.equal(usaItemValues({ ...form, title: "  Selected collectible  " }, path).title, "Selected collectible");
});
test("invalid catalog values fail before photo uploads or data mutations", () => {
  for (const price of ["-1", "NaN", "1e3", "1.234", "1000000000", "1,200"]) assert.throws(() => usaItemValues({ ...form, usd_price: price }, path));
  for (const change of [{title:"x"},{title:"x".repeat(201)},{description:"short"},{description:"x".repeat(1501)},{status:"active"},{item_url:"https://evil.com/item"}]) assert.throws(() => usaItemValues({ ...form, ...change }, path));
  assert.throws(() => usaItemValues(form, null), /photo/);
  assert.throws(() => usaItemValues(form, "private/receipt.jpg"), /photo/);
});
test("quote selection contains item fields only and never creates an order or payment", () => {
  const item = { ...usaItemValues(form, path), id, admin_id: "owner", contact_email: "private@example.com" };
  const selected = usaQuoteSelection(item);
  assert.deepEqual(Object.keys(selected).sort(), ["item_details", "item_name", "item_url"]);
  assert.equal(selected.item_name, form.title);
  assert(selected.item_details.includes("full delivered quote"));
  assert.equal(usaQuoteSelection({ ...item, status: "draft" }), null);
  assert.equal(usaQuoteSelection({ ...item, status: "archived" }), null);
  assert.equal(usaQuoteSelection({ ...item, id: "bad" }), null);
});
test("sign-in returns only to the local USA page with a validated item ID", () => {
  for (const target of ["/usa-shopping", "/usa-shopping#usa-quote", `/usa-shopping?item=${id}#usa-quote`]) assert.equal(usaSignInReturn(target), target);
  for (const target of [null, "//evil.com", "https://evil.com", "/usa-shopping?next=https://evil.com", "/usa-shopping?item=bad", "/usa-shopping/../admin", "/usa-shopping%2f%2fevil.com", "/usa-shopping\n", "/admin"]) assert.equal(usaSignInReturn(target), null);
});
