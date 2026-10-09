import test from "node:test";
import assert from "node:assert/strict";
import { handleFacebookSync } from "../lib/facebook-sync.mjs";
import { editableFacebookPost, facebookSyncBusy, facebookSyncInProgress } from "../lib/facebook-sync-state.mjs";
import { syncFacebookAfterEdit, updateFacebookDetails } from "../lib/facebook-edit-sync.mjs";
import { facebookCaption } from "../lib/facebook-publishing.mjs";

const pageId="1286818197857823",postId=pageId+"_123",time=Date.parse("2026-10-10T01:00:00Z");
const product={id:5,seller_id:"admin",title:"Updated item",description:"Latest details",price:150,status:"active",quantity:3,
  variations:[{name:"Blue",quantity:3}],location:"Manila",condition:"New",shipping_carrier:"LBC",shipping_fee:85};
const initialJob={listing_id:"5",owner_id:"admin",page_id:pageId,status:"published",post_id:postId,claim_token:"old",
  message:"Listing posted to Facebook.",updated_at:"2026-10-09T01:00:00Z",attempts:1};
function fixture(options={}) {
  let job=options.job===null?null:{...initialJob,...options.job},reads=0,claim=0;
  const graph=[],writes=[],env={NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_ANON_KEY:"public",
    SUPABASE_SERVICE_ROLE_KEY:"server-secret",FACEBOOK_PAGE_ID:pageId,FACEBOOK_PAGE_ACCESS_TOKEN:"page-secret",...options.env};
  const user={auth:{getUser:async()=>options.hangAuth?new Promise(()=>{}):options.authError?{error:{}}:{data:{user:{id:"admin"}}}},
    rpc:async()=>({data:options.admin??true}),from:()=>{
      const filters={};return {select(){return this;},eq(k,v){filters[k]=v;return this;},is(k,v){filters[k]=v;return this;},
        async maybeSingle(){assert.equal(filters.seller_id,"admin");assert.equal(filters.status,"active");assert.equal(filters.deleted_at,null);
          if(options.hangRead)return new Promise(()=>{});
          const value=options.products?options.products[Math.min(reads++,options.products.length-1)]:options.product;
          return {data:value===null?null:{...product,...value}};}};
    }};
  const server={from:()=>{
    let update=null;const filters={};return {select(){return this;},eq(k,v){filters[k]=v;return this;},update(value){update=value;return this;},
      async maybeSingle(){
        if(!update)return {data:job?structuredClone(job):null};
        writes.push({update,filters});
        const reserving=!!update.claim_token;
        if((reserving && options.hangReserve)||(!reserving && options.hangFinish))return new Promise(()=>{});
        if((reserving && options.reserveError)||(!reserving && options.finishError))return {error:{message:"server-secret"}};
        if(options.loseReserve && reserving)return {data:null};
        if(!job || Object.entries(filters).some(([k,v])=>job[k]!==v))return {data:null};
        job={...job,...update};return {data:{listing_id:job.listing_id}};
      }};
  }};
  const fetchImpl=async(url,request)=>{
    graph.push({url,request});
    if(options.gate)await options.gate;
    if(options.networkError)throw Error("page-secret");
    if(options.hangGraph)return new Promise(()=>{});
    if(options.hangJson)return {ok:true,status:200,json:()=>new Promise(()=>{})};
    return Response.json(options.graph??{success:true},{status:options.graphStatus??200});
  };
  const run=()=>handleFacebookSync(new Request("https://pinoybuynsell.com/api/facebook/sync",{method:"POST",
    headers:options.noAuth?{}:{Authorization:"Bearer user-session"},body:JSON.stringify(options.body??{listingId:"5"})}),
    {env,createClient:(_url,key)=>key===env.SUPABASE_SERVICE_ROLE_KEY?server:user,fetchImpl,now:()=>time,newClaim:()=>"new-"+(++claim),
      databaseTimeoutMs:options.databaseTimeoutMs??8000,graphTimeoutMs:options.graphTimeoutMs??20000});
  return {run,graph,writes,job:()=>job};
}

test("sync requires an authenticated administrator and a valid listing ID",async()=>{
  for(const [options,status] of [[{noAuth:true},401],[{authError:true},401],[{admin:false},403],[{body:{listingId:"5/../feed"}},400]]){
    const f=fixture(options);assert.equal((await f.run()).status,status);assert.equal(f.graph.length,0);assert.equal(f.writes.length,0);
  }
});
test("only an administrator's own active undeleted listing can sync",async()=>{
  for(const item of [null,{seller_id:"other"},{status:"sold"},{deleted_at:"2026-10-10"}]){
    const f=fixture({product:item});assert.equal((await f.run()).status,403);assert.equal(f.graph.length,0);
  }
});
test("untracked shares skip syncing, and unconfirmed or wrong-Page posts cannot update",async()=>{
  const absent=fixture({job:null});assert.equal((await (await absent.run()).json()).status,"skipped");assert.equal(absent.graph.length,0);
  for(const job of [{status:"failed"},{status:"processing"},{status:"uncertain"},{page_id:"999"},{post_id:"123"},{post_id:pageId+"_123/feed"}]){
    const f=fixture({job});assert.equal((await f.run()).status,409);assert.equal(f.graph.length,0);assert.equal(f.writes.length,0);
  }
  const f=fixture({job:{owner_id:"another"}});assert.equal((await f.run()).status,403);assert.equal(f.graph.length,0);
});
test("configured credentials and a successful conditional reservation are required",async()=>{
  for(const options of [{env:{SUPABASE_SERVICE_ROLE_KEY:""}},{env:{FACEBOOK_PAGE_ACCESS_TOKEN:""}},{env:{FACEBOOK_GRAPH_API_VERSION:"../feed"}},{reserveError:true}]){
    const f=fixture(options);assert.equal((await f.run()).status,503);assert.equal(f.graph.length,0);
  }
  const f=fixture({loseReserve:true});assert.equal((await (await f.run()).json()).status,"processing");assert.equal(f.graph.length,0);
});
test("sync updates only the saved feed post's message using the latest server listing",async()=>{
  const f=fixture({body:{listingId:"5",postId:"999_888",pageId:"999",message:"untrusted"}});
  const response=await f.run();assert.equal(response.status,200);assert.equal((await response.json()).status,"synced");
  assert.equal(f.graph.length,1);const {url,request}=f.graph[0];assert.equal(url,`https://graph.facebook.com/v26.0/${postId}`);
  assert.equal(request.method,"POST");assert.equal(request.headers.Authorization,"Bearer page-secret");
  assert.deepEqual([...new URLSearchParams(request.body).keys()],["message"]);
  assert.equal(new URLSearchParams(request.body).get("message"),facebookCaption(product));
  assert.equal(f.job().status,"published");assert.equal(f.job().post_id,postId);assert.equal(f.job().attempts,1);
  assert(f.writes.every(({update})=>!("status" in update)&&!("post_id" in update)));
  assert.equal(f.writes[0].filters.claim_token,"old");assert.equal(f.writes[0].filters.updated_at,initialJob.updated_at);
});
test("active update locks block concurrent requests; stale update locks are retryable",async()=>{
  const active=fixture({job:{message:facebookSyncInProgress,updated_at:new Date(time-60000).toISOString()}});
  assert.equal((await (await active.run()).json()).status,"processing");assert.equal(active.graph.length,0);
  const stale=fixture({job:{message:facebookSyncInProgress,updated_at:new Date(time-121000).toISOString()}});
  assert.equal((await stale.run()).status,200);assert.equal(stale.graph.length,1);
  assert(editableFacebookPost(initialJob,pageId));assert(!editableFacebookPost(initialJob,"123_456"));assert(!facebookSyncBusy(initialJob,time));
});
test("simultaneous requests cannot both claim an update",async()=>{
  let release;const gate=new Promise(r=>release=r),f=fixture({gate});
  const first=f.run(),second=f.run();
  const blocked=await Promise.race([first,second]);assert.equal((await blocked.json()).status,"processing");
  release();const results=await Promise.all([first,second]);assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(f.graph.length,1);
});
test("overlapping edits are reread and coalesced into the same Facebook post",async()=>{
  const changed={...product,title:"A newer save",price:200};
  const f=fixture({products:[product,product,changed,changed,changed]});assert.equal((await f.run()).status,200);
  assert.equal(f.graph.length,2);assert.equal(f.graph[0].url,f.graph[1].url);
  assert.equal(new URLSearchParams(f.graph[1].request.body).get("message"),facebookCaption(changed));
});
test("continuous edits leave an explicit retry message instead of claiming stale success",async()=>{
  const f=fixture({products:Array.from({length:7},(_,i)=>({...product,title:`Save ${i}`}))});
  const result=await (await f.run()).json();assert.equal(result.status,"pending");assert.equal(f.graph.length,3);assert.match(result.message,/latest version/);
  assert.equal(f.job().status,"published");
});
test("definite Meta rejection keeps the published post and redacts provider secrets",async()=>{
  for(const code of [190,200,368]){
    const f=fixture({graph:{error:{code,message:"page-secret"}},graphStatus:400});const response=await f.run();assert.equal(response.status,422);
    const result=await response.json();assert.equal(result.status,"failed");assert(!result.message.includes("page-secret"));
    assert.equal(f.job().status,"published");assert.equal(f.job().post_id,postId);assert.equal(f.graph.length,1);
  }
});
test("unknown Meta outcomes are bounded and safe to retry as updates",async()=>{
  for(const options of [{networkError:true},{graph:{}},{graph:{error:{message:"page-secret"}},graphStatus:500},{hangGraph:true},{hangJson:true}]){
    const f=fixture({...options,graphTimeoutMs:10});const result=await (await f.run()).json();
    assert.equal(result.status,"uncertain");assert(!result.message.includes("page-secret"));assert.equal(f.job().status,"published");assert.equal(f.graph.length,1);
    await f.run();assert.equal(f.graph.length,2);assert(f.graph.every(x=>x.url.endsWith("/"+postId)));
  }
});
test("unavailable reads or reservations never reach Meta; failed result writes never claim success",async()=>{
  for(const options of [{hangAuth:true},{hangRead:true},{hangReserve:true}]){
    const f=fixture({...options,databaseTimeoutMs:10});assert.equal((await f.run()).status,503);assert.equal(f.graph.length,0);
  }
  for(const options of [{finishError:true},{hangFinish:true}]){
    const f=fixture({...options,databaseTimeoutMs:10});const response=await f.run();assert.equal(response.status,503);assert.equal((await response.json()).status,"uncertain");assert.equal(f.graph.length,1);
  }
});
test("auction captions carry the saved closing time in Philippine time",()=>{
  const caption=facebookCaption({...product,listing_type:"auction",auction_starting_price:150,auction_ends_at:"2026-10-12T01:00:00Z"});
  assert.match(caption,/Auction closes \(Philippine time\):/);assert.match(caption,/9:00:00/);
});
test("ordinary sellers skip Page sync and administrator edits send only the listing ID",async()=>{
  let calls=0;const client={rpc:async()=>({data:false}),auth:{getSession:async()=>({data:{session:{access_token:"user-session"}}})}};
  const fetchImpl=async(url,request)=>{calls++;assert.equal(url,"/api/facebook/sync");assert.deepEqual(JSON.parse(request.body),{listingId:"5"});return Response.json({status:"synced",message:"Updated."});};
  assert.equal((await syncFacebookAfterEdit(client,"5",{fetchImpl})).status,"skipped");assert.equal(calls,0);
  client.rpc=async()=>({data:true});assert.equal((await syncFacebookAfterEdit(client,"5",{fetchImpl})).status,"synced");assert.equal(calls,1);
});
test("client failures keep website-save success distinct and JSON parsing has a deadline",async()=>{
  const client={rpc:async()=>({data:true}),auth:{getSession:async()=>({data:{session:{access_token:"user-session"}}})}};
  const result=await syncFacebookAfterEdit(client,"5",{timeoutMs:10,fetchImpl:async()=>({json:()=>new Promise(()=>{})})});
  assert.equal(result.status,"uncertain");assert.match(result.message,/listing is saved/);
  const absent={...client,auth:{getSession:async()=>({data:{session:null}})}};
  await assert.rejects(()=>updateFacebookDetails(absent,"5"),/Sign in again/);
  await assert.rejects(()=>updateFacebookDetails(client,"../5"),/Invalid listing/);
});
