import test from "node:test";
import assert from "node:assert/strict";
import { handlePaymentReceipt } from "../lib/payment-receipts.mjs";
const buyer="11111111-1111-4111-8111-111111111111", orderId="22222222-2222-4222-8222-222222222222", receiptId="33333333-3333-4333-8333-333333333333";
const png=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);
const env={NEXT_PUBLIC_SUPABASE_URL:"https://fixture.invalid",NEXT_PUBLIC_SUPABASE_ANON_KEY:"public",SUPABASE_SERVICE_ROLE_KEY:"private-secret"};
function fixture({owner=buyer,order=true,status="awaiting_payment",publicBucket=false,exists=false,uploadError=false,savedError=false,hang=false,metadata={},missingBucket=false,denyBucket=false}={}) {
 const calls=[]; let bucketExists=!missingBucket;
 const path=`${buyer}/${orderId}/${receiptId}.png`;
 const receipt={id:receiptId,order_id:orderId,buyer_id:buyer,path,content_type:"image/png",...metadata};
 const createClient=(_url,key)=>{
  const server=key===env.SUPABASE_SERVICE_ROLE_KEY;
  return {auth:{getUser:async()=>hang?new Promise(()=>{}):{data:{user:{id:buyer}},error:null}},
   from(table) {let insert=false;const q={select(){return q;},eq(){return q;},maybeSingle(){return q;},single(){return q;},insert(row){calls.push({insert:row});insert=true;return q;},async abortSignal(){
    calls.push({table,server});
    if(table==="marketplace_orders")return {data:order?{id:orderId,buyer_id:owner,status}:null};
    if(insert)return savedError?{error:{message:"private-secret"}}:{data:{id:receiptId,order_id:orderId}};
    return {data:server?(exists?receipt:null):receipt};
   }};return q;},
   storage:{getBucket:async()=>{calls.push({bucket:true});return bucketExists?{data:{public:publicBucket}}:{error:{statusCode:"404"}};},createBucket:async(name,options)=>{calls.push({createBucket:name,options}); if(!denyBucket)bucketExists=true;return denyBucket?{error:{statusCode:"403"}}:{data:{name}};},from(){return{
    upload:async(path,bytes,options)=>{calls.push({upload:path,options});return uploadError?{error:{statusCode:"409"}}:{data:{path}};},
    download:async path=>{calls.push({download:path});return {data:new Blob([png])};},
   };}}
  };
 };
 return {calls,createClient};
}
function post(bytes=png,{receipt=receiptId,auth=true}={}){
 const f=new FormData();f.set("orderId",orderId);f.set("receiptId",receipt);f.set("receipt",new File([bytes],"receipt.png",{type:"image/png"}));
 return new Request("https://fixture.invalid/api/marketplace/payments/receipts",{method:"POST",body:f,headers:auth?{Authorization:"Bearer fixture"}:{}});
}
const get=()=>new Request(`https://fixture.invalid/api/marketplace/payments/receipts?orderId=${orderId}&receiptId=${receiptId}`,{headers:{Authorization:"Bearer fixture"}});
async function run(request,f,options={}) {return handlePaymentReceipt(request,{env,createClient:f.createClient,...options});}
test("authentication and order RLS run before private storage; other buyers cannot read",async()=>{
 const a=fixture();assert.equal((await run(post(png,{auth:false}),a)).status,401);assert.equal(a.calls.length,0);
 const b=fixture({order:false});assert.equal((await run(get(),b)).status,404);assert.equal(b.calls.some(c=>c.server||c.bucket),false);
 const c=fixture({owner:orderId});assert.equal((await run(post(),c)).status,403);assert.equal(c.calls.some(c=>c.bucket||c.upload),false);
});
test("uploads are byte-validated, buyer-scoped, private and do not confirm payment",async()=>{
 const f=fixture(),r=await run(post(),f);assert.equal(r.status,200);assert.deepEqual(await r.json(),{id:receiptId,orderId});
 const upload=f.calls.find(c=>c.upload);assert.equal(upload.upload,`${buyer}/${orderId}/${receiptId}.png`);assert.equal(upload.options.upsert,false);
 const row=f.calls.find(c=>c.insert).insert;assert.equal(row.buyer_id,buyer);assert.equal(row.content_type,"image/png");
 assert.equal(row.size_bytes,png.length);assert.equal(row.status,undefined);assert.equal(r.headers.get("cache-control"),"private, no-store");
 const invalid=fixture();assert.equal((await run(post(new TextEncoder().encode("not an image")),invalid)).status,400);assert(!invalid.calls.some(c=>c.bucket));
});
test("submitted orders, invalid IDs, oversized uploads and public buckets fail closed",async()=>{
 const done=fixture({status:"paid"});assert.equal((await run(post(),done)).status,409);assert(!done.calls.some(c=>c.upload));
 const invalid=fixture();assert.equal((await run(post(png,{receipt:"../../public"}),invalid)).status,400);
 const large=fixture();assert.equal((await run(post(new Uint8Array(5*1024*1024+1)),large)).status,400);assert(!large.calls.some(c=>c.upload));
 const publicStore=fixture({publicBucket:true});assert.equal((await run(post(),publicStore)).status,503);assert(!publicStore.calls.some(c=>c.upload));
});
test("receipt GET requires authorized order and matching immutable receipt metadata",async()=>{
 const f=fixture(),r=await run(get(),f);assert.equal(r.status,200);assert.equal(r.headers.get("content-type"),"image/png");assert.equal(r.headers.get("x-content-type-options"),"nosniff");assert.deepEqual(new Uint8Array(await r.arrayBuffer()),png);
 for(const metadata of [{path:"other-buyer/private.jpg"},{buyer_id:orderId},{order_id:receiptId},{content_type:"image/svg+xml"}]){
  const bad=fixture({metadata});assert.equal((await run(get(),bad)).status,404);assert(!bad.calls.some(c=>c.download));
 }
 const publicStore=fixture({publicBucket:true});assert.equal((await run(get(),publicStore)).status,503);assert(!publicStore.calls.some(c=>c.download));
});
test("same upload request is idempotent; unknown writes never retry or expose secrets",async()=>{
 const existing=fixture({exists:true});assert.equal((await run(post(),existing)).status,200);assert(!existing.calls.some(c=>c.upload));
 const duplicate=fixture({uploadError:true});assert.equal((await run(post(),duplicate)).status,200);assert.equal(duplicate.calls.filter(c=>c.upload).length,1);
 const failed=fixture({savedError:true}),r=await run(post(),failed);assert.equal(r.status,503);assert.equal(failed.calls.filter(c=>c.insert).length,1);assert(!(await r.text()).includes("private-secret"));
 const hung=fixture({hang:true});assert.equal((await run(post(),hung,{timeoutMs:5})).status,503);assert.equal(hung.calls.length,0);
});

test("missing buckets are provisioned privately; failed provisioning prevents uploads",async()=>{
 const f=fixture({missingBucket:true});assert.equal((await run(post(),f)).status,200);
 const created=f.calls.find(c=>c.createBucket);assert.equal(created.createBucket,'payment-receipts');assert.equal(created.options.public,false);assert.equal(created.options.fileSizeLimit,5242880);assert.deepEqual(created.options.allowedMimeTypes,['image/jpeg','image/png','image/webp']);
 const denied=fixture({missingBucket:true,denyBucket:true});assert.equal((await run(post(),denied)).status,503);assert(!denied.calls.some(c=>c.upload));
});
