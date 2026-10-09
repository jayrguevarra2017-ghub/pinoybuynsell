import Link from "next/link";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import { categories } from "@/lib/data";
import { getBrowseListings } from "@/lib/public-listings.mjs";
import { publicPageMetadata } from "@/lib/seo.mjs";

export const dynamic = "force-dynamic";
function filters(searchParams) {
  const text = value => typeof value === "string" ? value.trim().slice(0, 150) : "";
  const category = text(searchParams?.category);
  return { query: text(searchParams?.q), category: categories.some(c => c.name === category) ? category : "",
    page: Math.min(1000, Math.max(1, Number.parseInt(searchParams?.page, 10) || 1)) };
}

export function generateMetadata({ searchParams }) {
  const { query, category, page } = filters(searchParams);
  const metadata = publicPageMetadata({ path: "/search", title: "Browse Items for Sale in the Philippines | PinoyBuyNSell",
    description: "Browse current marketplace listings, compare item prices and shipping fees, and discover new and pre-owned goods from sellers across the Philippines." });
  // Keep duplicate search/filter URLs out of search results while allowing item links to be followed.
  if (query || category || page > 1 || Object.keys(searchParams || {}).length) metadata.robots = { index: false, follow: true };
  return metadata;
}

export default async function SearchPage({ searchParams }) {
  const filter = filters(searchParams);
  let products = [], unavailable = false;
  try { products = await getBrowseListings(filter, { env: process.env }); } catch { unavailable = true; }
  const pageUrl = page => {
    const params = new URLSearchParams({ ...(filter.query ? { q: filter.query } : {}), ...(filter.category ? { category: filter.category } : {}), page: String(page) });
    return `/search?${params}`;
  };
  return <><Header /><main className="page"><div className="container">
    <p className="eyebrow">BROWSE MARKETPLACE</p>
    <h1>{filter.category ? `${filter.category} Listings` : filter.query ? `Search results for “${filter.query}”` : "All Listings"}</h1>
    <p>Find new and pre-owned items from sellers across the Philippines.</p>
    <form action="/search" className="browse-filters">
      <label>Search items<input name="q" type="search" maxLength={150} defaultValue={filter.query} placeholder="Item name or description" /></label>
      <label>Category<select name="category" defaultValue={filter.category}><option value="">All categories</option>{categories.map(c => <option key={c.name}>{c.name}</option>)}</select></label>
      <button className="sell" type="submit">Search</button>
    </form>
    {unavailable ? <p role="alert">Listings could not be loaded. Please refresh to try again.</p> : products.length ?
      <div className="product-grid">{products.slice(0, 24).map(product => <ProductCard key={product.id} product={product} />)}</div> :
      <><h2>No listings found</h2><p>Try another search or category.</p><Link className="view inline" href="/search">Browse all items</Link></>}
    {!unavailable && <nav className="browse-pagination" aria-label="Listing pages">
      {filter.page > 1 && <Link className="secondary" href={pageUrl(filter.page - 1)}>← Previous</Link>}
      {products.length > 24 && filter.page < 1000 && <Link className="secondary" href={pageUrl(filter.page + 1)}>Next →</Link>}
    </nav>}
  </div></main></>;
}
