const categoryTags = {
  "Collectibles": "#CollectiblesPH",
  "Electronics": "#ElectronicsPH",
  "Phones": "#PhonesPH",
  "Fashion": "#FashionPH",
  "Home & Living": "#HomeAndLivingPH",
  "Vehicles": "#VehiclesPH",
  "Sports": "#SportsPH",
  "Jobs & Services": "#ServicesPH",
};

// Use public item titles and known categories, never contact details or IDs.
// A short allowlist avoids turning arbitrary listing text into promotional tags.
export function listingHashtags(product) {
  const title = typeof product?.title === "string"
    ? product.title.slice(0, 200).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase() : "";
  const category = typeof product?.category === "string" ? product.category.trim() : "";
  const pokemon = /\bpokemon\b/.test(title), yugioh = /\byu[ -]?gi[ -]?oh\b/.test(title);
  const magic = /\b(?:magic:?[ ]+the[ ]+gathering|mtg)\b/.test(title);
  const basketball = /\b(?:basketball|nba|michael jordan|kobe bryant|lebron james|victor wembanyama)\b/.test(title);
  const tennis = /\b(?:tennis|alex(?:andra)? eala)\b/.test(title), baseball = /\bbaseball\b/.test(title);
  const card = magic || /\b(?:trading cards?|sports cards?|basketball cards?|baseball cards?|tennis cards?|football cards?|nba cards?|tcg|ccg|upper deck|collector'?s choice|panini|topps|fleer|prizm|skybox)\b/.test(title)
    || ((pokemon || yugioh || magic || basketball || tennis || baseball) && /\b(?:cards?|booster|elite trainer box|etb|(?:psa|bgs|cgc)\s*\d+)\b/.test(title));
  const topics = [];
  if (pokemon) topics.push(card ? "#PokemonTCG" : "#Pokemon");
  if (yugioh) topics.push(card ? "#YuGiOhTCG" : "#YuGiOh");
  if (magic) topics.push("#MagicTheGathering");
  if (card && /\bone piece\b/.test(title)) topics.push("#OnePieceTCG");
  if (card && basketball) {
    topics.push("#BasketballCards");
    for (const [pattern, tag] of [[/\bmichael jordan\b/, "#MichaelJordan"], [/\bkobe bryant\b/, "#KobeBryant"], [/\blebron james\b/, "#LeBronJames"], [/\bvictor wembanyama\b/, "#VictorWembanyama"]]) {
      if (pattern.test(title)) topics.push(tag);
    }
  }
  if (card && tennis) topics.push("#TennisCards");
  if (card && /\balex(?:andra)? eala\b/.test(title)) topics.push("#AlexEala");
  if (card && baseball) topics.push("#BaseballCards");
  if (card && (pokemon || yugioh || magic || /\btcg\b/.test(title))) topics.push("#TCGPhilippines");
  const categoryTag = card ? "#TradingCardsPH" : Object.hasOwn(categoryTags, category) ? categoryTags[category] : null;
  const tags = ["#PinoyBuyNSell", "#BuyAndSellPH", categoryTag, ...topics].filter(Boolean);
  const result = [...new Set(tags)].slice(0, 5);
  if (product?.status !== "sold") {
    if (product?.listing_type === "auction") result.push("#OnlineAuctionPH");
    else if (product?.listing_type === "fixed_price") result.push("#ForSalePH");
  }
  return result;
}

export function appendListingHashtags(caption, product) {
  const existing = new Set((caption.match(/#[\p{L}\p{N}_]+/gu) || []).map(tag => tag.toLowerCase()));
  const additional = listingHashtags(product).filter(tag => !existing.has(tag.toLowerCase()));
  return additional.length ? `${caption}\n\n${additional.join(" ")}` : caption;
}
