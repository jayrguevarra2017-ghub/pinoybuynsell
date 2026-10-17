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

export const maxListingHashtags = 10;

const basketballPlayers = [
  [/\bmichael jordan\b/, "#MichaelJordan"], [/\bkobe bryant\b/, "#KobeBryant"],
  [/\blebron james\b/, "#LeBronJames"], [/\bvictor wembanyama\b/, "#VictorWembanyama"],
  [/\b(?:stephen|steph) curry\b/, "#StephenCurry"], [/\bluka doncic\b/, "#LukaDoncic"],
  [/\bkevin durant\b/, "#KevinDurant"], [/\bshaquille o['’]?neal\b/, "#ShaquilleONeal"],
];
const cardBrandTags = [
  [/\bupper deck\b/, "#UpperDeck"], [/\bcollector'?s choice\b/, "#CollectorsChoice"],
  [/\bpanini\b/, "#Panini"], [/\btopps\b/, "#Topps"], [/\bfleer\b/, "#Fleer"],
  [/\bskybox\b/, "#SkyBox"], [/\bnba hoops\b/, "#NBAHoops"],
];
const cardDetailTags = [
  [/\btopps now\b/, "#ToppsNow"], [/\b(?:topps|cosmic) chrome\b/, "#ToppsChrome"],
  [/\b(?:panini )?prizm\b/, "#Prizm"], [/\bjordan legacy\b/, "#JordanLegacy"],
  [/\b(?:rookie|rc)\b/, "#RookieCard"],
  [/\brefractor\b/, "#Refractor"], [/\binsert\b/, "#InsertCards"],
  [/\bbooster\b/, "#BoosterPacks"], [/\b(?:elite trainer box|etb)\b/, "#EliteTrainerBox"],
];
const basketballTeamTags = [
  [/\b(?:chicago bulls|bulls)\b/, "#ChicagoBulls"],
  [/\b(?:(?:los angeles|la) lakers|lakers)\b/, "#LALakers"],
  [/\b(?:san antonio spurs|spurs)\b/, "#SanAntonioSpurs"],
  [/\b(?:golden state warriors|warriors)\b/, "#GoldenStateWarriors"],
  [/\b(?:boston celtics|celtics)\b/, "#BostonCeltics"],
];
const matchingTags = (title, rules) => rules.filter(([pattern]) => pattern.test(title)).map(([, tag]) => tag);

function itemSpecificTags(title, category, { card, basketball, tennis }) {
  const tags = [];
  if (card) {
    // Match a stated grade only, never a certificate, card or phone number.
    const grade = title.match(/\b(psa|bgs|cgc)\s*(10|[1-9](?:\.5)?)(?![\d.])\b/);
    if (grade) tags.push(`#${grade[1].toUpperCase()}${grade[2].replace(".", "")}`);
    tags.push(...matchingTags(title, cardBrandTags), ...matchingTags(title, cardDetailTags));
    if (/\b(?:autograph(?:ed)?|auto|signed)\b/.test(title) && !/\b(?:no|non|not)\W+(?:autograph(?:ed)?|auto|signed)\b/.test(title)) tags.push("#AutographCards");
    if (basketball) {
      if (/\bnba\b/.test(title) || basketballPlayers.some(([pattern]) => pattern.test(title))) tags.push("#NBA");
      tags.push(...matchingTags(title, basketballTeamTags));
    }
    if (tennis && /\bwta\b/.test(title)) tags.push("#WTA");
    if (grade || (/\bgraded\b/.test(title) && !/\b(?:not graded|ungraded|un-graded)\b/.test(title))) tags.push("#GradedCards");
    if (/\bmewtwo\b/.test(title) && /\bpokemon\b/.test(title)) tags.push("#Mewtwo");
    if (/\bpikachu\b/.test(title) && /\bpokemon\b/.test(title)) tags.push("#Pikachu");
    if (/\bcharizard\b/.test(title) && /\bpokemon\b/.test(title)) tags.push("#Charizard");
    return tags;
  }
  if (["Collectibles", "Sports", "Fashion"].includes(category)) {
    tags.push(...matchingTags(title, basketballPlayers));
    if (basketball) tags.push("#Basketball", ...matchingTags(title, basketballTeamTags));
    if (/\bjersey\b/.test(title)) tags.push("#Jersey");
  }
  if (category === "Collectibles" && /\b(?:playing cards?|trick deck|card magic)\b/.test(title)) {
    tags.push("#PlayingCards");
    if (/\b(?:trick deck|card magic)\b/.test(title)) tags.push("#CardMagic");
    if (/\bbicycle\b/.test(title)) tags.push("#BicycleCards");
  }
  if (category === "Phones" || category === "Electronics") {
    tags.push(...matchingTags(title, [
      [/\biphone\b/, "#iPhone"], [/\bsamsung\b/, "#Samsung"], [/\bsamsung\s+galaxy\b/, "#SamsungGalaxy"],
      [/\bgarmin\b/, "#Garmin"], [/\bfish\s*finder\b/, "#FishFinder"],
      [/\b(?:smartwatch|smart watch)\b/, "#Smartwatch"], [/\blaptop\b/, "#Laptop"],
      [/\b(?:camera|dslr|mirrorless)\b/, "#CameraGear"],
    ]));
    // A constrained model number keeps the tag useful without copying free text.
    const iphone = title.match(/\biphone\s*(1[1-9])(?:\s*(pro\s*max|pro|plus|mini))?\b/);
    if (iphone) tags.push(`#iPhone${iphone[1]}${iphone[2] ? iphone[2].split(/\s+/).map(word => word[0].toUpperCase() + word.slice(1)).join("") : ""}`);
    const striker = title.match(/\bgarmin\s+striker\s+(4|5|7|9)\b/);
    if (striker) tags.push(`#GarminStriker${striker[1]}`);
    if (/\bfish\s*finder\b/.test(title)) tags.push("#FishingGear");
  }
  if (category === "Fashion") tags.push(...matchingTags(title, [
    [/\bnike\b/, "#Nike"], [/\badidas\b/, "#Adidas"], [/\bsneakers?\b/, "#Sneakers"],
  ]));
  if (category === "Home & Living" && /\b(?:table|chair|sofa|cabinet|desk)\b/.test(title)) tags.push("#Furniture");
  return tags;
}

// Use public item titles and known categories, never contact details or IDs.
// A short allowlist avoids turning arbitrary listing text into promotional tags.
export function listingHashtags(product) {
  const title = typeof product?.title === "string"
    ? product.title.slice(0, 200).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase() : "";
  const category = typeof product?.category === "string" ? product.category.trim() : "";
  const pokemon = /\bpokemon\b/.test(title), yugioh = /\byu[ -]?gi[ -]?oh\b/.test(title);
  const magic = /\b(?:magic:?[ ]+the[ ]+gathering|mtg)\b/.test(title);
  const basketball = /\b(?:basketball|nba)\b/.test(title) || basketballPlayers.some(([pattern]) => pattern.test(title));
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
    topics.push(...matchingTags(title, basketballPlayers));
  }
  if (card && tennis) topics.push("#TennisCards");
  if (card && /\balex(?:andra)? eala\b/.test(title)) topics.push("#AlexEala");
  if (card && baseball) topics.push("#BaseballCards");
  if (card && (pokemon || yugioh || magic || /\btcg\b/.test(title))) topics.push("#TCGPhilippines");
  const categoryTag = card ? "#TradingCardsPH" : Object.hasOwn(categoryTags, category) ? categoryTags[category] : null;
  const tags = ["#PinoyBuyNSell", "#BuyAndSellPH", categoryTag, ...topics,
    ...itemSpecificTags(title, category, { card, basketball, tennis })].filter(Boolean);
  // Preserve the original website/category/topic tags first, then add item
  // details. Reserve the final place for the original selling-format tag.
  const result = [...new Set(tags)].slice(0, maxListingHashtags - 1);
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
