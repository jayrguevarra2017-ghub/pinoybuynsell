import { cache } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import OrderedProductGrid from "@/components/OrderedProductGrid";
import { getBrowseListings } from "@/lib/public-listings.mjs";
import { breadcrumbs, collectionPageNumber, collectiblesSEO, publicPageMetadata, serializeJsonLd } from "@/lib/seo.mjs";

export const dynamic = "force-dynamic";
const readItems = cache(page => getBrowseListings({ category: "Collectibles", page }, { env: process.env }));
const pagePath = page => `/collectibles${page > 1 ? `?page=${page}` : ""}`;

export async function generateMetadata({ searchParams }) {
  const page = collectionPageNumber((await searchParams)?.page);
  const metadata = publicPageMetadata({ ...collectiblesSEO, path: pagePath(page),
    ...(page > 1 ? { title: `Trading Cards & TCG — Page ${page} | PinoyBuyNSell` } : {}) });
  // Confirmed empty collections are not useful search landing pages. A failed
  // database read must remain a server error, not an instruction to deindex.
  if (!(await readItems(page)).length) metadata.robots = { index: false, follow: true };
  return metadata;
}

export default async function Collectibles({ searchParams }) {
  const page = collectionPageNumber((await searchParams)?.page);
  const products = await readItems(page);
  const trail = [{ name: "Home", path: "/" }, { name: "Trading cards & collectibles", path: "/collectibles" }];
  return <><Header/><main className="page"><div className="container collectible-page">
    <nav className="seo-breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Trading cards &amp; collectibles</span></nav>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbs(trail)) }}/>
    <p className="eyebrow">PINOYBUYNSELL · FOR COLLECTORS</p>
    <h1>Trading cards, TCG &amp; collectibles in the Philippines</h1>
    <p className="lead">Explore NBA basketball cards, Pokémon trading card game (TCG) items, tennis cards and other collectibles. Check each listing’s photos, condition, price and shipping details before buying or bidding.</p>
    <nav className="collection-links" aria-label="Explore collectible listings">
      {[ ["Michael Jordan", "Michael Jordan"], ["Kobe Bryant", "Kobe Bryant"], ["Pokémon TCG", "Pokémon"] ].map(([label, query]) => <Link key={label} href={`/search?${new URLSearchParams({ category: "Collectibles", q: query })}`}>{label}</Link>)}
      <Link href="/auctions">Browse auctions</Link>
    </nav>
    <section aria-labelledby="collectible-listings"><h2 id="collectible-listings">Collectible listings{page > 1 ? ` — page ${page}` : ""}</h2>
      {products.length ? <OrderedProductGrid products={products.slice(0, 24)} refreshOnExpiry/>
        : <p>No collectible listings on this page right now. <Link href="/search">Browse all marketplace items.</Link></p>}
      <nav className="browse-pagination" aria-label="Collectible listing pages">
        {page > 1 && <Link className="secondary" href={pagePath(page - 1)}>← Previous</Link>}
        {products.length > 24 && page < 1000 && <Link className="secondary" href={pagePath(page + 1)}>Next →</Link>}
      </nav>
    </section>
    <section className="collection-guide" aria-labelledby="collectible-buying"><h2 id="collectible-buying">Buying trading cards and TCG items</h2>
      <p>Use the actual listing photos to review the card, edition and stated condition. For graded cards, review the seller’s stated grade and certification details. Availability and auction closing times appear on the item page.</p>
      <p>Fixed-price items use checkout; bidding requires an approved account. Payments are by GCash or bank deposit with receipt upload and manual confirmation. Check the <Link href="/payment-rules">payment and return rules</Link> before ordering.</p>
      <h2>Shopping for collectibles from US stores</h2><p>Found a card or TCG item on a US store? Request <Link href="/usa-shopping">USA to Philippines shopping and shipping assistance</Link>. Item availability, service fees, shipping and import charges are confirmed in a quote before purchase.</p>
      <h2>Selling on PinoyBuyNSell</h2><p>Listing items is currently available to marketplace administrators. Members can browse, buy, follow sellers and bid after account approval; selling for members is coming soon.</p>
    </section>
  </div></main></>;
}
