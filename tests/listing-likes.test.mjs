import test from "node:test";
import assert from "node:assert/strict";
import {listingLikeId,likesRequest,parseListingLikes,createListingLikesStore} from "../lib/listing-likes.mjs";

const pause=()=>new Promise(r=>setTimeout(r,10));
const row=(id,count=0,liked=false)=>({listing_id:id,like_count:count,liked});
test("like IDs accept only positive PostgreSQL integers without unsafe numeric rounding",()=>{
  for(const value of [1,"5","9223372036854775807"])assert.equal(listingLikeId(value),String(value));
  for(const value of [0,-1,"0","01","5,6","5/other",null,undefined,1.5,"9223372036854775808",9007199254740992])assert.equal(listingLikeId(value),null);
});
test("count responses cannot invent totals or include unrequested listing data",()=>{
  assert.deepEqual(parseListingLikes([row("5",2,true)],["5"]).get("5"),{count:2,liked:true,loaded:true,busy:false,error:null});
  for(const response of [null,{},[row("6")],[row("5"),row("5")],[row("5",-1)],[row("5","2")],[row("5",1,"yes")]])
    assert.throws(()=>parseListingLikes(response,["5"]),/unavailable/);
});
test("database errors are safely displayed and stalled like requests time out",async()=>{
  await assert.rejects(()=>likesRequest(Promise.resolve({error:{code:"PGRST202",message:"private-provider-details"}})),/temporarily unavailable/);
  await assert.rejects(()=>likesRequest(new Promise(()=>{}),10),/not confirmed/);
  assert.deepEqual(await likesRequest(Promise.resolve({data:[row("5")]})),[row("5")]);
});
test("visible hearts share one batched read and stay empty until actual counts arrive",async()=>{
  const reads=[],store=createListingLikesStore({batchDelayMs:0,read:async ids=>{reads.push(ids);return ids.map(id=>row(id,3));}});
  store.subscribe("5",()=>{});store.subscribe("5",()=>{});store.subscribe("6",()=>{});
  assert.equal(store.get("5").count,null);await pause();assert.equal(reads.length,0);
  store.activate(true);await pause();assert.deepEqual(reads,[["5","6"]]);assert.equal(store.get("5").count,3);store.dispose();
});
test("large visible batches are split to the SQL limit of 100",async()=>{
  const reads=[],store=createListingLikesStore({batchDelayMs:0,read:async ids=>{reads.push(ids);return ids.map(id=>row(id));}});
  for(let i=1;i<=105;i++)store.subscribe(String(i),()=>{});
  store.activate(true);await pause();assert.deepEqual(reads.map(x=>x.length),[100,5]);store.dispose();
});
test("one in-flight mutation prevents duplicate clicks and updates all subscribed instances only on confirmation",async()=>{
  let resolve,writes=0,notifications=0;
  const store=createListingLikesStore({batchDelayMs:0,read:async()=>[row("5",2)],write:()=>{writes++;return new Promise(r=>resolve=r);}});
  store.subscribe("5",()=>notifications++);store.subscribe("5",()=>notifications++);store.activate(true);await pause();
  const first=store.toggle("5"),second=store.toggle("5");assert.equal(writes,1);assert.equal(store.get("5").liked,false);assert.equal(store.get("5").count,2);assert.equal(store.get("5").busy,true);
  resolve(row("5",3,true));await Promise.all([first,second]);assert.equal(store.get("5").liked,true);assert.equal(store.get("5").count,3);assert.equal(store.get("5").busy,false);assert(notifications>=6);store.dispose();
});
test("likes and unlikes send explicit desired states; repeated state requests never add multiple likes",async()=>{
  const calls=[],store=createListingLikesStore({batchDelayMs:0,read:async()=>[row("5")],write:async(id,liked)=>{calls.push([id,liked]);return row(id,liked?1:0,liked);}});
  store.subscribe("5",()=>{});store.activate(true);await pause();await store.toggle("5");await store.toggle("5");
  assert.deepEqual(calls,[["5",true],["5",false]]);assert.equal(store.get("5").count,0);store.dispose();
});
test("unknown write outcomes never pretend success or automatically repeat a mutation",async()=>{
  let writes=0;const store=createListingLikesStore({batchDelayMs:0,read:async()=>[row("5",1,true)],write:async()=>{writes++;throw Error("Like change not confirmed. Refresh likes to check.");}});
  store.subscribe("5",()=>{});store.activate(true);await pause();await store.toggle("5");
  assert.equal(store.get("5").loaded,false);assert.equal(store.get("5").count,null);assert.match(store.get("5").error,/not confirmed/);
  await store.toggle("5");assert.equal(writes,1);store.refresh("5");await pause();assert.equal(store.get("5").liked,true);assert.equal(writes,1);store.dispose();
});
test("late reads cannot overwrite refreshed state or a changed account's store",async()=>{
  const resolves=[],store=createListingLikesStore({batchDelayMs:0,read:()=>new Promise(r=>resolves.push(r))});
  store.subscribe("5",()=>{});store.activate(true);await pause();store.refresh("5");await pause();
  resolves[1]([row("5",2,true)]);await pause();resolves[0]([row("5",0,false)]);await pause();assert.equal(store.get("5").count,2);
  store.refresh("5");await pause();store.dispose();resolves[2]([row("5",999,false)]);await pause();assert.equal(store.get("5").count,2);
  const other=createListingLikesStore({read:async()=>[]});assert.equal(other.get("5").count,null);other.dispose();
});
test("missing or unavailable listings never display fabricated zero counts",async()=>{
  const store=createListingLikesStore({batchDelayMs:0,read:async()=>[]});store.subscribe("5",()=>{});store.activate(true);await pause();
  assert.equal(store.get("5").count,null);assert.equal(store.get("5").loaded,false);assert.match(store.get("5").error,/unavailable/);store.dispose();
});
test("effect cleanup and replay can reactivate the store without accepting old requests",async()=>{
  const store=createListingLikesStore({batchDelayMs:0,read:async()=>[row("5",4)]});
  store.subscribe("5",()=>{});store.activate(true);store.dispose();store.subscribe("5",()=>{});store.activate(true);await pause();
  assert.equal(store.get("5").count,4);store.dispose();
});
