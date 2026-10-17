import test from "node:test";
import assert from "node:assert/strict";
import { readPublicListings, getSitemapListings } from "../lib/public-listings.mjs";
import { productStructuredData } from "../lib/seo.mjs";

const env={NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_ANON_KEY:"public-key"};

test("public reads tolerate both additive columns missing, removing only the failing capabilities",async()=>{
  const calls=[];
  const rows=await readPublicListings({select:"id,image_paths,relisted_to_id"},{env,fetchImpl:async url=>{
    const p=new URL(url).searchParams; calls.push(p);
    if(p.get("select").includes("image_paths")) return Response.json({code:"42703",message:"column products.image_paths does not exist"},{status:400});
    if(p.has("relisted_to_id")) return Response.json({code:"42703",message:"column products.relisted_to_id does not exist"},{status:400});
    return Response.json([{id:4,status:"active"}]);
  }});
  assert.equal(calls.length,3); assert.equal(rows[0].id,4);
  assert.equal(calls[2].get("select"),"id"); assert.equal(calls[2].get("relisted_to_id"),null);
});

test("sitemaps filter replacements even when their projection lacks relist fields",async()=>{
  let calls=0;
  const rows=await getSitemapListings({env,fetchImpl:async url=>{
    const p=new URL(url).searchParams; calls++;
    if(calls===1) {
      assert.equal(p.get("relisted_to_id"),"is.null");
      return Response.json({code:"42703",message:"column products.relisted_to_id does not exist"},{status:400});
    }
    assert.equal(p.get("select"),"id,category,status,deleted_at");
    assert.equal(p.get("relisted_to_id"),null);
    return Response.json([{id:28,status:"active",category:"Collectibles"}]);
  }});
  assert.equal(calls,2); assert.deepEqual(rows.map(row=>row.id),[28]);
});

test("unrelated public read failures are not retried as missing relist schema",async()=>{
  let calls=0;
  await assert.rejects(readPublicListings({select:"id,relisted_to_id"},{env,fetchImpl:async()=>{
    calls++; return Response.json({code:"42501",message:"permission denied"},{status:403});
  }}),/Public listings unavailable/);
  assert.equal(calls,1);
  assert.equal(productStructuredData("4",{id:4,status:"active",listing_type:"fixed_price",price:100,relisted_to_id:28},{}),null);
});
