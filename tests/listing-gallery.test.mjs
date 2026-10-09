import test from "node:test";
import assert from "node:assert/strict";
import { listingPhotoPaths } from "../lib/listing-gallery.mjs";
import { createListing, updateListing } from "../lib/listing-photo.js";
import { getFeaturedListings } from "../lib/public-listings.mjs";

const owner = "11111111-1111-4111-8111-111111111111";
const path = `${owner}/22222222-2222-4222-8222-222222222222.jpg`;
const photo = () => new File([new Uint8Array([255,216,255,224])], "photo.jpg", { type: "image/jpeg" });
function mock({ missing = false, rejected = false, unknown = false, uploadFailure = false } = {}) {
  const calls = { uploads: [], removes: [], writes: [] };
  const result = async () => {
    if (unknown) throw Error("Response lost");
    return rejected ? { error: { message: "Rejected" } } : { data: { id: 5 } };
  };
  const client = {
    storage: { from: () => ({ upload: async (path, file, options) => {
      if (uploadFailure && calls.uploads.length === 1) return { error: { message: "Failed" } };
      calls.uploads.push({ path, file, options }); return {};
    }, remove: async paths => { calls.removes.push(paths); return {}; } }) },
    from: () => ({
      select: () => ({ limit: async () => missing ? { error: { code: "42703", message: "column products.image_paths does not exist" } } : { data: [] } }),
      insert: values => { calls.writes.push(values); return { select: () => ({ single: result }) }; },
      update: values => { calls.writes.push(values); const query = { eq: () => query, select: () => ({ single: result }) }; return query; },
    }),
  };
  return { client, calls };
}

test("gallery keeps the cover first, supports legacy single photos, and ignores unsafe paths", () => {
  const next = path.replace("22222222", "33333333");
  assert.deepEqual(listingPhotoPaths({ image_path: path }), [path]);
  assert.deepEqual(listingPhotoPaths({ image_path: path, image_paths: [next,path,"../../private.jpg"] }), [path,next]);
  assert.deepEqual(listingPhotoPaths(null), []);
});

test("gallery uploads save all paths in order with the first image as cover", async () => {
  const { client, calls } = mock();
  await createListing(client, owner, { title: "Test" }, [{ file: photo() }, { file: photo() }]);
  assert.equal(calls.uploads.length,2);
  assert.deepEqual(calls.writes[0].image_paths, calls.uploads.map(u => u.path));
  assert.equal(calls.writes[0].image_path,calls.uploads[0].path);
  assert(calls.uploads.every(u => u.options.contentType === "image/jpeg" && !u.options.upsert));
});

test("pending migration allows a single photo but rejects multiple photos before any write", async () => {
  const single = mock({ missing: true });
  await createListing(single.client,owner,{},photo());
  assert.equal(single.calls.uploads.length,1); assert(!("image_paths" in single.calls.writes[0]));
  const multiple = mock({ missing: true });
  await assert.rejects(createListing(multiple.client,owner,{},[{file:photo()},{file:photo()}]),/setup is not complete/);
  assert.equal(multiple.calls.uploads.length,0);assert.equal(multiple.calls.writes.length,0);
});

test("edits retain existing objects, can reorder the cover, and can remove all photo references", async () => {
  const { client, calls } = mock();
  await updateListing(client,owner,5,{},[{file:photo()},{path}]);
  assert.equal(calls.uploads.length,1);assert.equal(calls.writes[0].image_paths[1],path);
  await updateListing(client,owner,5,{},[]);
  assert.deepEqual(calls.writes[1],{image_path:null,image_paths:[]});assert.equal(calls.removes.length,0);
  await updateListing(client,owner,5,{title:"Details only"},null);
  assert.deepEqual(calls.writes[2],{title:"Details only"});
});

test("foreign paths, too many photos and invalid later files reject before uploading", async () => {
  const { client,calls } = mock();
  await assert.rejects(createListing(client,owner,{},[{path:path.replace(owner,"33333333-3333-4333-8333-333333333333")}]),/does not belong/);
  await assert.rejects(createListing(client,owner,{},Array.from({length:9},()=>({file:photo()}))),/up to 8/);
  await assert.rejects(createListing(client,owner,{},[{file:photo()},{file:new File(["invalid"],"bad.jpg",{type:"image/jpeg"})}]),/not a readable photo/);
  assert.equal(calls.uploads.length,0);assert.equal(calls.writes.length,0);
});

test("explicit save rejection and partial upload failure clean up only new objects", async () => {
  const rejected = mock({rejected:true});
  await assert.rejects(updateListing(rejected.client,owner,5,{},[{path},{file:photo()},{file:photo()}]),/Rejected/);
  assert.deepEqual(rejected.calls.removes[0],rejected.calls.uploads.map(u=>u.path));
  assert(!rejected.calls.removes[0].includes(path));
  const partial = mock({uploadFailure:true});
  await assert.rejects(createListing(partial.client,owner,{},[{file:photo()},{file:photo()}]),/Failed/);
  assert.deepEqual(partial.calls.removes[0],partial.calls.uploads.map(u=>u.path));assert.equal(partial.calls.writes.length,0);
});

test("unknown database outcomes retain uploaded photos instead of deleting a potentially saved gallery", async () => {
  const {client,calls}=mock({unknown:true});
  await assert.rejects(createListing(client,owner,{},[{file:photo()},{file:photo()}]),/Response lost/);
  assert.equal(calls.uploads.length,2);assert.equal(calls.removes.length,0);
});

test("public reads fall back only for a missing gallery column while retaining public filters", async () => {
  const env={NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_ANON_KEY:"anon"};let calls=0;
  const data=await getFeaturedListings({env,fetchImpl:async url=>{
    const params=new URL(url).searchParams;assert.equal(params.get("status"),"eq.active");assert.equal(params.get("deleted_at"),"is.null");
    calls++;
    if(calls===1){assert(params.get("select").includes("image_paths"));return Response.json({code:"42703",message:"column products.image_paths does not exist"},{status:400});}
    assert(!params.get("select").includes("image_paths"));return Response.json([{id:5,status:"active",image_path:path}]);
  }});
  assert.equal(calls,2);assert.equal(data[0].image_path,path);
  await assert.rejects(getFeaturedListings({env,fetchImpl:async()=>Response.json({code:"42501",message:"Denied"},{status:403})}),/unavailable/);
});
