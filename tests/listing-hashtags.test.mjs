import test from "node:test";
import assert from "node:assert/strict";
import { listingHashtags, appendListingHashtags } from "../lib/listing-hashtags.mjs";
import { facebookCaption } from "../lib/facebook-caption.mjs";

const jordan = { id: 7, title: "Upper Deck Michael Jordan #79 PSA 8", category: "Collectibles", listing_type: "fixed_price", status: "active", price: 5000, quantity: 1 };

test("basketball card posts get short, relevant item and Philippines hashtags", () => {
  const tags = listingHashtags(jordan);
  for (const tag of ["#PinoyBuyNSell", "#BuyAndSellPH", "#TradingCardsPH", "#BasketballCards", "#MichaelJordan", "#ForSalePH"]) assert(tags.includes(tag));
  assert(!tags.includes("#PokemonTCG")); assert(!tags.includes("#TCGPhilippines"));
  assert.equal(new Set(tags).size, tags.length); assert(tags.length <= 10);
});

test("Pokemon spelling and auction hashtags work without treating every collectible as a TCG", () => {
  const tags = listingHashtags({ ...jordan, title: "Pokémon TCG Elite Trainer Box", listing_type: "auction" });
  assert(tags.includes("#PokemonTCG")); assert(tags.includes("#TCGPhilippines")); assert(tags.includes("#OnlineAuctionPH"));
  assert(!tags.includes("#BasketballCards")); assert(!tags.includes("#ForSalePH"));
  for (const title of ["Pokémon plush toy", "Magic trick deck", "Michael Jordan jersey", "Playing cards gift set"]) {
    const result = listingHashtags({ ...jordan, title });
    assert(!result.includes("#TCGPhilippines")); assert(!result.includes("#TradingCardsPH"));
  }
});

test("non-card listings use their own category without unrelated card or shipping tags", () => {
  for (const [category, title, expected] of [["Phones", "iPhone 15", "#PhonesPH"], ["Electronics", "Garmin smartwatch", "#ElectronicsPH"], ["Home & Living", "Coffee table", "#HomeAndLivingPH"], ["Fashion", "Sneakers", "#FashionPH"]]) {
    const tags = listingHashtags({ ...jordan, category, title });
    assert(tags.includes(expected)); assert(!tags.includes("#TradingCardsPH")); assert(!tags.includes("#USAtoPhilippines"));
  }
});

test("known TCG names and Alex or Alexandra Eala card titles get the appropriate topics", () => {
  for (const [title, tag] of [["Yu-Gi-Oh card", "#YuGiOhTCG"], ["Magic: The Gathering Bloomburrow", "#MagicTheGathering"], ["One Piece TCG booster", "#OnePieceTCG"], ["Alex Eala tennis card", "#AlexEala"], ["2026 Topps Now Tennis #18 ALEXANDRA EALA First WTA Title", "#AlexEala"]]) {
    const tags = listingHashtags({ ...jordan, title });
    assert(tags.includes(tag)); assert(tags.includes("#TradingCardsPH")); assert(tags.length <= 10);
  }
});

test("hashtag inference ignores private fields, arbitrary descriptions and unknown categories", () => {
  const clean = { title: "Selected item", category: "__proto__" };
  assert.deepEqual(listingHashtags({ ...clean, description: "Pokemon TCG", seller_id: "private-id", contact_phone: "09000000000", contact_email: "private@example.com", location: "Private street" }), listingHashtags(clean));
  for (const value of [null, undefined, {}, { title: {}, category: [] }, { title: "#".repeat(10000), category: "#Untrusted" }]) {
    const tags = listingHashtags(value);
    assert(tags.length >= 2 && tags.length <= 10); assert(tags.every(tag => /^#[A-Za-z][A-Za-z0-9]*$/.test(tag)));
  }
  const sold = listingHashtags({ ...jordan, status: "sold" });
  assert(!sold.includes("#ForSalePH")); assert(!sold.includes("#OnlineAuctionPH"));
});

test("automatic tags respect manually supplied hashtags and are idempotent", () => {
  const source = "A card for collectors. #pinoybuynsell #BUYANDSELLPH #MyOwnTag";
  const caption = appendListingHashtags(source, jordan);
  assert(caption.startsWith(source)); assert.equal((caption.match(/#pinoybuynsell/gi) || []).length, 1);
  assert.equal((caption.match(/#buyandsellph/gi) || []).length, 1); assert(caption.includes("#MyOwnTag"));
  assert.equal(appendListingHashtags(caption, jordan), caption);
  const many = listingHashtags({ ...jordan, title: "Pokemon TCG Yu-Gi-Oh MTG Michael Jordan basketball cards" });
  assert(many.length <= 10); assert.equal(many.at(-1), "#ForSalePH");
});

test("graded Jordan items keep all original tags and add the stated grade, card maker and set",()=>{
  const tags=listingHashtags({...jordan,title:'2009 Upper Deck Jordan Legacy GOLD #58 Michael Jordan PSA 10 GEM MINT - Cert 131750256',listing_type:'auction'});
  for(const tag of ['#PinoyBuyNSell','#BuyAndSellPH','#TradingCardsPH','#BasketballCards','#MichaelJordan','#OnlineAuctionPH',
    '#PSA10','#UpperDeck','#JordanLegacy','#NBA']) assert(tags.includes(tag),tag);
  assert.equal(tags.length,10);assert.equal(tags.at(-1),'#OnlineAuctionPH');
  assert(!tags.some(tag=>tag.includes('131750256')||tag==='#PSA8'));
});

test("rookie cards and Eala releases receive maker, series, team and item detail tags",()=>{
  const cases=[
    ['1996-97 NBA Hoops Kobe Bryant Rookie Card #281 – Los Angeles Lakers RC',['#NBAHoops','#RookieCard','#LALakers','#NBA','#KobeBryant']],
    ['2026 Topps Now Tennis #18 ALEXANDRA EALA First WTA Title',['#Topps','#ToppsNow','#WTA','#TennisCards','#AlexEala']],
    ['Alexandra Eala 2024 Topps Chrome Auto I #TCA-AEA #1 RC Rookie',['#Topps','#ToppsChrome','#RookieCard','#AutographCards','#AlexEala']],
    ['PSA 10 GEM MINT Mewtwo #024/066 – 2024 Pokémon Japanese Battle Academy',['#PokemonTCG','#PSA10','#Mewtwo','#GradedCards']],
    ['2018 Panini Stephen Curry Prizm basketball card',['#StephenCurry','#Panini','#Prizm','#NBA']],
  ];
  for(const [title,expected]of cases){
    const tags=listingHashtags({...jordan,title});
    for(const tag of expected)assert(tags.includes(tag),`${title}: ${tag}`);
    assert(tags.length<=10);assert.equal(new Set(tags).size,tags.length);
    assert(tags.includes('#PinoyBuyNSell'));assert(tags.includes('#BuyAndSellPH'));assert.equal(tags.at(-1),'#ForSalePH');
  }
});

test("non-card items gain relevant item tags without inheriting sports-card topics",()=>{
  for(const [category,title,expected]of[
    ['Electronics','Garmin Striker 4 fishfinder',['#Garmin','#GarminStriker4','#FishFinder','#FishingGear']],
    ['Phones','Apple iPhone 15 Pro Max',['#iPhone','#iPhone15ProMax']],
    ['Phones','Samsung Galaxy S24',['#Samsung','#SamsungGalaxy']],
    ['Collectibles','Bicycle ARRESTED Trick Deck by Adrian Vega & Penguin Magic – Rare Playing Cards',['#PlayingCards','#CardMagic','#BicycleCards']],
    ['Fashion','Nike sneakers',['#Nike','#Sneakers']],
    ['Home & Living','Coffee table',['#Furniture']],
  ]){
    const tags=listingHashtags({...jordan,title,category});
    for(const tag of expected)assert(tags.includes(tag),`${title}: ${tag}`);
    assert(!tags.includes('#TradingCardsPH'));assert(!tags.includes('#NBA'));assert(!tags.includes('#PSA10'));
    assert(tags.includes('#PinoyBuyNSell'));assert(tags.includes('#BuyAndSellPH'));assert.equal(tags.at(-1),'#ForSalePH');
  }
});

test("item tags are based on stated details rather than unrelated brands, guesses or certificate numbers",()=>{
  const pba=listingHashtags({...jordan,title:'PBA basketball trading card'});
  assert(pba.includes('#BasketballCards'));assert(!pba.includes('#NBA'));assert(!pba.includes('#ChicagoBulls'));
  const ungraded=listingHashtags({...jordan,title:'Upper Deck Michael Jordan - Cert 131750256'});
  assert(!ungraded.includes('#PSA10'));assert(!ungraded.includes('#GradedCards'));
  assert(!listingHashtags({...jordan,title:'Michael Jordan PSA 131750256 card'}).some(tag=>/^#PSA\d/.test(tag)));
  assert(!listingHashtags({...jordan,title:'Michael Jordan PSA 10.5 card'}).includes('#PSA10'));
  assert(!listingHashtags({...jordan,title:'Topps Chrome Eala RC non-auto'}).includes('#AutographCards'));
  assert(!listingHashtags({...jordan,title:'Upper Deck card not graded'}).includes('#GradedCards'));
  assert(!listingHashtags({title:'Galaxy star projector',category:'Electronics'}).includes('#SamsungGalaxy'));
  const title='Selected item #MyOwnTag';
  const clean={title,category:'Phones'};
  assert.deepEqual(listingHashtags({...clean,description:'iPhone 15 Pro Max',contact_phone:'09123456789',seller_id:'private-id',image_path:'PSA10.jpg'}),listingHashtags(clean));
  const caption=appendListingHashtags('Item #upperdeck #PSA10 #MyOwnTag',{...jordan,title:'Upper Deck Michael Jordan PSA 10 card'});
  assert.equal((caption.match(/#UpperDeck/gi)||[]).length,1);assert.equal((caption.match(/#PSA10/gi)||[]).length,1);
  assert(caption.includes('#MyOwnTag'));assert.equal(appendListingHashtags(caption,{...jordan,title:'Upper Deck Michael Jordan PSA 10 card'}),caption);
});

test("shared Facebook caption preserves item, shipping and payment details before appending tags", () => {
  const item = { ...jordan, description: "A graded card. #PinoyBuyNSell", shipping_carrier: "J&T Express", shipping_fee: 85, seller_id: "private-id", contact_email: "private@example.com" };
  const caption = facebookCaption(item);
  assert(caption.startsWith(item.title)); assert.match(caption, /₱5,000\.00/); assert.match(caption, /J&T Express.*₱85\.00/);
  assert(caption.includes("https://pinoybuynsell.com/product/7")); assert(caption.includes("GCash or bank deposit only"));
  assert(caption.includes("#MichaelJordan")); assert(caption.endsWith("#ForSalePH"));
  assert.equal((caption.match(/#PinoyBuyNSell/gi) || []).length, 1);
  assert(!caption.includes("private-id")); assert(!caption.includes("private@example.com"));
});
