import test from "node:test";
import assert from "node:assert/strict";
import { validSellerId, sellerUrl, validateRecommendation, communityRequest, communityError } from "../lib/seller-community.mjs";

test("seller links accept UUIDs and reject injected routes and filter expressions", () => {
 const id="11111111-1111-4111-8111-111111111111";
 assert.equal(sellerUrl(id),`/seller/${id}`);
 for (const value of [null, "", "../admin", "javascript:alert(1)", "id,or=(true)", "5", id+"/edit"]) {
  assert.equal(validSellerId(value),false); assert.equal(sellerUrl(value),null);
 }
});

test("recommendation length counts Unicode characters and rejects blank/oversized content", () => {
 assert.equal(validateRecommendation("  A helpful seller.  "),"A helpful seller.");
 assert.equal(validateRecommendation("😀".repeat(1000)).length,2000);
 for (const body of [null, "   ", "short", "x".repeat(1001), "😀".repeat(1001)]) assert.throws(()=>validateRecommendation(body),/10 and 1000/);
});

test("community requests expose failures without pretending that a mutation succeeded", async () => {
 assert.deepEqual(await communityRequest(Promise.resolve({data:{following:true},error:null})),{following:true});
 const error={code:"P0001",message:"You cannot recommend yourself."};
 await assert.rejects(communityRequest(Promise.resolve({data:null,error})),e=>e===error);
 assert.equal(communityError(error),error.message);
 assert.match(communityError({code:"PGRST202",message:"internal SQL details"}),/temporarily unavailable/);
 assert.ok(!communityError({code:"42501",message:"private internal details"}).includes("private"));
});

test("a stalled community request times out without automatically repeating writes", async () => {
 await assert.rejects(communityRequest(new Promise(()=>{}),10),/Refresh to check/);
});
