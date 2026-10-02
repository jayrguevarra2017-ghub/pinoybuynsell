import Link from "next/link";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import AuctionCard from "@/components/AuctionCard";
import { categories, products, auctions } from "@/lib/data";

export default function HomePage() {
  return <><Header />
    <main>
      <section className="hero"><div className="container hero-inner"><div><p className="eyebrow">🇵🇭 MADE FOR THE PHILIPPINES</p><h1>Buy. Sell. <span>Connect.</span></h1><p className="lead">Discover great deals from people and businesses across the Philippines. List your items and find your next great buy.</p><form className="search" action="/" method="get"><input name="q" placeholder="What are you looking for?"/><select name="category" defaultValue=""><option value="">All categories</option>{categories.map(c=><option key={c.name}>{c.name}</option>)}</select><button type="submit">Search</button></form></div><div className="hero-card"><div className="hero-mark">🛒</div><h3>Your local marketplace</h3><p>Find products near you and connect directly with sellers.</p><div className="stats"><div><strong>PH</strong><small>Local</small></div><div><strong>24/7</strong><small>Listings</small></div><div><strong>₱</strong><small>Great Deals</small></div></div></div></div></section>
      <section id="categories" className="section"><div className="container"><div className="section-head"><div><p className="eyebrow">EXPLORE</p><h2>Shop by category</h2></div><Link href="#browse">View all →</Link></div><div className="category-grid">{categories.map(c=><Link className="category" href={`/search?category=${encodeURIComponent(c.name)}`} key={c.name}><span>{c.icon}</span><strong>{c.name}</strong><small>Browse listings</small></Link>)}</div></div></section>
      <section id="browse" className="section listings"><div className="container"><div className="section-head"><div><p className="eyebrow">JUST LISTED</p><h2>Featured items</h2></div><Link href="#browse">See all listings →</Link></div><div className="product-grid">{products.slice(0,4).map(p=><ProductCard key={p.id} product={p}/>)}</div></div></section>
      <section id="auctions" className="section"><div className="container"><div className="section-head"><div><p className="eyebrow">BID & WIN</p><h2>Live auctions</h2></div><Link href="/auctions">View all auctions →</Link></div><div className="auction-grid">{auctions.map(a=><AuctionCard key={a.id} auction={a}/>)}</div></div></section>
      <section className="how"><div className="container"><p className="eyebrow">SIMPLE & EASY</p><h2>How PinoyBuyNSell works</h2><div className="steps"><div><span>1</span><h3>Find an item</h3><p>Search listings and discover products you like.</p></div><div><span>2</span><h3>Connect</h3><p>Contact the seller and agree on the details.</p></div><div><span>3</span><h3>Buy or sell</h3><p>Complete your transaction and enjoy your deal.</p></div></div></div></section>
    </main><footer><div className="container footer"><div><Link className="logo footer-logo" href="/">Pinoy<span>BuyNSell</span></Link><p>Your Philippine online marketplace.</p></div><p>© 2026 PinoyBuyNSell</p></div></footer></>;
}
