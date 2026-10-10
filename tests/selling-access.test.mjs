import test from "node:test";
import assert from "node:assert/strict";
import { readSellingAccess, requireSellingAccess, sellingComingSoon } from "../lib/selling-access.mjs";
import { createListing, updateListing } from "../lib/listing-photo.js";

const owner="11111111-1111-4111-8111-111111111111";

test("selling uses the trusted admin RPC and accepts unverified admins without reading signup metadata",async()=>{
  const calls=[];
  const client={rpc:async name=>{calls.push(name);return {data:true};},auth:{getUser:()=>{throw Error("User metadata must not grant selling");}}};
  assert.equal(await readSellingAccess(client),true);
  await requireSellingAccess(client);
  assert.deepEqual(calls,["is_marketplace_admin","is_marketplace_admin"]);
});

test("verified ordinary users still receive the selling-coming-soon restriction",async()=>{
  const client={rpc:async name=>{assert.equal(name,"is_marketplace_admin");return {data:false};}};
  assert.equal(await readSellingAccess(client),false);
  await assert.rejects(requireSellingAccess(client),{message:sellingComingSoon});
});

test("permission errors and malformed responses fail closed without exposing provider details",async()=>{
  for(const result of [{data:true,error:{message:"secret provider info"}},{data:"true"},{data:1},null]){
    await assert.rejects(readSellingAccess({rpc:async()=>result}),{message:"Could not confirm administrator access. Please try again."});
  }
  await assert.rejects(readSellingAccess({rpc:async()=>{throw Error("secret");}}),/Could not confirm/);
});

test("a hanging role check is bounded and cannot start a listing write",async()=>{
  await assert.rejects(readSellingAccess({rpc:()=>new Promise(()=>{})},10),/Could not confirm/);
});

test("create and edit reject non-admins before converting photos, uploading, or writing any listing",async()=>{
  let writes=0;
  const client={rpc:async()=>({data:false}),from:()=>{writes++;throw Error("write attempted");},storage:{from:()=>{writes++;throw Error("upload attempted");}}};
  const unreadable=new File(["not an image"],"phone.heic",{type:"image/heic"});
  await assert.rejects(createListing(client,owner,{title:"new"},[{file:unreadable}]),{message:sellingComingSoon});
  await assert.rejects(updateListing(client,owner,5,{title:"edit"},[{file:unreadable}]),{message:sellingComingSoon});
  assert.equal(writes,0);
});

test("admin authority is checked again on every save so revocation prevents the next edit",async()=>{
  let allowed=true,writes=0,checks=0;
  const result=()=>({select:()=>({single:async()=>{writes++;return {data:{id:5}};}})});
  const client={rpc:async()=>{checks++;return {data:allowed};},from:()=>({insert:result,update:()=>{const q={eq:()=>q,...result()};return q;}})};
  await createListing(client,owner,{title:"admin item"},null);
  await updateListing(client,owner,5,{title:"admin edit"},null);
  allowed=false;
  await assert.rejects(updateListing(client,owner,5,{title:"revoked edit"},null),{message:sellingComingSoon});
  assert.equal(writes,2);assert.equal(checks,3);
});
