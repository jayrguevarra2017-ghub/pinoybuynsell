import test from "node:test";
import assert from "node:assert/strict";
import { collectionPageNumber, breadcrumbs, serializeJsonLd, publicPageMetadata, collectiblesSEO, usaShoppingSEO, homeSEO } from "../lib/seo.mjs";
import { categories } from "../lib/data.js";

test("collectible pagination accepts only bounded positive page numbers", () => {
  assert.equal(collectionPageNumber("1"), 1); assert.equal(collectionPageNumber("2"), 2); assert.equal(collectionPageNumber("1000"), 1000);
  for (const value of [undefined, [], ["2"], "0", "-1", "2junk", "2.5", "1e2", "1001", "<script>"]) assert.equal(collectionPageNumber(value), 1);
});
test("breadcrumbs preserve ordered canonical destinations and safely serialize item titles", () => {
  const data = breadcrumbs([{ name: "Home", path: "/" }, { name: "Trading cards", path: "/collectibles" }, { name: "Card </script>", path: "/product/4" }]);
  assert.deepEqual(data.itemListElement.map(item => item.position), [1, 2, 3]);
  assert.equal(data.itemListElement[1].item, "https://pinoybuynsell.com/collectibles");
  assert(!serializeJsonLd(data).includes("</script>")); assert.deepEqual(JSON.parse(serializeJsonLd(data)), data);
});
test("each topic has its own canonical landing page and Collectibles is a supported category", () => {
  const home = publicPageMetadata(homeSEO), collection = publicPageMetadata(collectiblesSEO), usa = publicPageMetadata(usaShoppingSEO);
  assert.equal(new Set([home.alternates.canonical, collection.alternates.canonical, usa.alternates.canonical]).size, 3);
  assert.equal(collection.alternates.canonical, "https://pinoybuynsell.com/collectibles");
  assert.equal(usa.alternates.canonical, "https://pinoybuynsell.com/usa-shopping");
  assert.equal(categories.filter(c => c.name === "Collectibles").length, 1);
});
