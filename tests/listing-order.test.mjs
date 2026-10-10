import test from "node:test";
import assert from "node:assert/strict";
import { listingAvailability, sortMarketplaceListings, latestListingAuction, auctionCardFromProduct, sortAuctionCards } from "../lib/listing-order.mjs";
import { getBrowseListings, getFeaturedListings } from "../lib/public-listings.mjs";
import { fetchMarketplaceListings } from "../lib/marketplace-client.mjs";

const now = Date.parse("2026-10-10T00:00:00Z");
const fixed = (id, changes={}) => ({id,status:"active",listing_type:"fixed_price",quantity:1,created_at:"2026-10-09T00:00:00Z",...changes});
const auction = (id, end, changes={}) => fixed(id,{listing_type:"auction",auctions:{id:id*10,status:"active",starts_at:"2026-10-09T00:00:00Z",ends_at:end},...changes});
const env={NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_ANON_KEY:"public-key",SUPABASE_SERVICE_ROLE_KEY:"private-key"};

// Filter and page the fake REST dataset, rather than returning a pre-sorted page.
function restFixture(rows, calls=[]) {
  return async (url, options) => {
    const p=new URL(url).searchParams; calls.push(p);
    assert.equal(options.headers.Authorization,"Bearer public-key");
    assert.equal(p.get("status"),"in.(active,sold)"); assert.equal(p.get("deleted_at"),"is.null");
    assert(!p.get("select").includes("seller_id"));
    let result=rows.filter(r=>["active","sold"].includes(r.status)&&!r.deleted_at);
    if (p.has("id")) {const ids=p.get("id").slice(4,-1).split(","); result=result.filter(r=>ids.includes(String(r.id)));}
    else result=result.slice(Number(p.get("offset")),Number(p.get("offset"))+Number(p.get("limit")));
    return Response.json(result);
  };
}

test("available and soonest closing items precede upcoming, sold, ended and out-of-stock listings",()=>{
  const items=[fixed(8,{status:"sold"}),auction(4,"2026-10-11T00:00:00Z"),fixed(7,{quantity:0}),
    auction(6,"2026-10-12T00:00:00Z",{auctions:{status:"ended",ends_at:"2026-10-12T00:00:00Z"}}),
    auction(1,"2026-10-10T00:00:01Z"),fixed(3),auction(5,"2026-10-09T23:59:59Z"),
    auction(2,"2026-10-13T00:00:00Z",{auctions:{status:"active",starts_at:"2026-10-12T00:00:00Z",ends_at:"2026-10-13T00:00:00Z"}})];
  const original=[...items];
  assert.deepEqual(sortMarketplaceListings(items,now).map(x=>x.id),[1,4,3,2,8,7,6,5]);
  assert.deepEqual(items,original);
  assert.equal(listingAvailability(items[0],now).label,"Sold");
  assert.equal(listingAvailability(items[2],now).label,"Out of stock");
});

test("at the exact closing time an auction moves below available stock and cannot show live bidding",()=>{
  const items=[auction(1,"2026-10-10T00:00:01Z"),fixed(2)];
  assert.deepEqual(sortMarketplaceListings(items,now).map(x=>x.id),[1,2]);
  assert.deepEqual(sortMarketplaceListings(items,now+1000).map(x=>x.id),[2,1]);
  assert.equal(listingAvailability(items[0],now+1000).label,"Bidding ended");
  assert.equal(listingAvailability({...items[0],status:"sold"},now).label,"Sold");
});

test("newest available stock wins ties; numeric IDs settle duplicate dates consistently",()=>{
  const rows=[fixed(2),fixed(10),fixed(1,{created_at:"2026-10-10"}),fixed(100,{created_at:"2026-10-08"})];
  assert.deepEqual(sortMarketplaceListings(rows,now).map(x=>x.id),[1,10,2,100]);
});

test("only the latest auction determines availability, with array/object and legacy timestamp support",()=>{
  const item=auction(1,"2026-10-11",{auctions:[{id:1,created_at:"2026-10-01",status:"ended",ends_at:"2026-10-08"},
    {id:2,created_at:"2026-10-09",status:"active",ends_at:"2026-10-11",current_bid:300}]});
  assert.equal(latestListingAuction(item).id,2);
  assert.equal(listingAvailability(item,now).state,"active");
  assert.equal(auctionCardFromProduct(item).currentBid,300);
  assert.equal(listingAvailability({...item,auctions:null,auction_ends_at:"2026-10-11"},now).state,"active");
  for (const broken of ["", "invalid"]) assert.equal(listingAvailability({...item,auctions:{status:"active",ends_at:broken}},now).state,"unavailable");
  assert.equal(listingAvailability({...item,auctions:{status:"active",starts_at:"2026-10-12",ends_at:"2026-10-11"}},now).state,"unavailable");
});

test("auction cards retain photos and use the same availability order after expiry",()=>{
  const items=[auction(1,"2026-10-10T00:00:01Z",{image_path:"photo.jpg"}),auction(2,"2026-10-11"),auction(3,"2026-10-11",{status:"sold"})].map(auctionCardFromProduct);
  assert.deepEqual(sortAuctionCards(items,now+1000).map(x=>x.productId),[2,3,1]);
  assert.equal(items[0].imagePath,"photo.jpg");
});

test("ordering occurs before browse pagination so newer closed rows cannot hide old available items",async()=>{
  const rows=Array.from({length:60},(_,i)=>fixed(i+1,{status:i<30?"active":"sold",created_at:new Date(now+i*1000).toISOString()}));
  rows.push(fixed(99,{status:"draft"}),fixed(100,{deleted_at:"2026-10-10"}));
  const fetchImpl=restFixture(rows);
  const first=await getBrowseListings({page:1},{env,fetchImpl});
  const second=await getBrowseListings({page:2},{env,fetchImpl});
  assert.equal(first.length,25); assert(first.every(x=>x.status==="active"));
  assert.deepEqual(first.slice(0,24).map(x=>x.id),Array.from({length:24},(_,i)=>30-i));
  assert.deepEqual(second.slice(0,6).map(x=>x.id),[6,5,4,3,2,1]);
  assert(second.slice(6).every(x=>x.status==="sold"));
  const featured=await getFeaturedListings({env,fetchImpl});
  assert.equal(featured.length,12); assert(featured.every(x=>x.status==="active"));
});

test("index pagination reaches old available items beyond Supabase's first 1000 rows",async()=>{
  const rows=Array.from({length:1001},(_,i)=>fixed(i+1,{status:i===1000?"active":"sold"}));
  const calls=[];
  const page=await getBrowseListings({}, {env,fetchImpl:restFixture(rows,calls)});
  assert.equal(page[0].id,1001);
  assert.deepEqual(calls.filter(p=>p.has("offset")).map(p=>p.get("offset")),["0","1000"]);
  assert(calls[0].get("select").includes("auctions("));
  assert(!calls[0].get("select").includes("image_path"));
  assert(calls.at(-1).get("select").includes("image_path"));
});

test("public index and detail reads reject private, deleted, unrelated rows and repeated-page IDs",async()=>{
  let calls=0;
  const data=await getBrowseListings({}, {env,fetchImpl:async()=>Response.json(++calls===1?
    [fixed(1),fixed(2,{status:"draft"}),fixed(3,{deleted_at:"today"})]:
    [fixed(1),fixed(2),fixed(3),fixed(4,{status:"draft"}),fixed(5,{deleted_at:"today"})])});
  assert.deepEqual(data.map(x=>x.id),[1]);
  await assert.rejects(getBrowseListings({}, {env,fetchImpl:async()=>Response.json([fixed(1),fixed(1)])}),/index changed/);
  await assert.rejects(getBrowseListings({}, {env,fetchImpl:async()=>Response.json([fixed("1),status.eq.draft")])}),/index changed/);
});

test("seller/category filters constrain the public index; query wildcards and delimiters are escaped",async()=>{
  await getBrowseListings({sellerId:"00000000-0000-0000-0000-000000000001",category:'A\\B"C',query:'*card%,status.eq.draft'}, {env,fetchImpl:async url=>{
    const p=new URL(url).searchParams;
    assert.equal(p.get("seller_id"),'eq."00000000-0000-0000-0000-000000000001"');
    assert.equal(p.get("category"),'eq."A\\\\B\\"C"');
    assert.equal(p.get("or"),'(title.ilike."*card,status.eq.draft*",description.ilike."*card,status.eq.draft*")');
    return Response.json([]);
  }});
});

test("client listing refresh is read-only and rejects unavailable or malformed responses",async()=>{
  const data=await fetchMarketplaceListings({mode:"auctions",page:2},async(url,options)=>{
    assert.equal(url,"/api/marketplace/listings?mode=auctions&page=2");
    assert.equal(options.cache,"no-store"); assert.equal(options.method,undefined); assert.equal(options.headers,undefined);
    return Response.json({items:[{id:1}]});
  });
  assert.deepEqual(data,[{id:1}]);
  for (const response of [Response.json({items:"bad"}),Response.json({message:"secret-provider-error"},{status:503})]) {
    await assert.rejects(fetchMarketplaceListings({},async()=>response),/Listings could not be loaded/);
  }
});

test("a saturated public index fails visibly instead of silently losing available listings",async()=>{
  let calls=0;
  await assert.rejects(getFeaturedListings({env,fetchImpl:async url=>{
    const p=new URL(url).searchParams; assert(p.has("offset")); calls++;
    const start=Number(p.get("offset"));
    return Response.json(Array.from({length:1000},(_,i)=>fixed(start+i+1,{status:"sold"})));
  }}),/requires database pagination/);
  assert.equal(calls,10);
  assert.equal(listingAvailability(fixed(1,{status:"sold",deleted_at:"today"}),now).rank,3);
});
