"use client";
import SiteLogo from "@/components/SiteLogo";

import { useEffect, useState } from "react";
import Link from "next/link";
import { facebookPageUrl, messengerUrl } from "@/lib/facebook";
import USAShoppingHero from "@/components/USAShoppingHero";
import Header from "@/components/Header";
import OrderedProductGrid from "@/components/OrderedProductGrid";
import AuctionCard from "@/components/AuctionCard";
import { categories } from "@/lib/data";
import { fetchMarketplaceListings } from "@/lib/marketplace-client.mjs";
import { sortAuctionCards } from "@/lib/listing-order.mjs";
import useMarketplaceClock from "./useMarketplaceClock";
import { useApp } from "./AppProvider";

export default function HomePage({ initialProducts = null }) {
  const app = useApp();
  const [products, setProducts] = useState(initialProducts || []);
  const [loadingProducts, setLoadingProducts] = useState(initialProducts === null);
  const [auctions, setAuctions] = useState([]);
  const [loadingAuctions, setLoadingAuctions] = useState(true);

  const [listingError, setListingError] = useState("");
  const [auctionError, setAuctionError] = useState("");
  const now = useMarketplaceClock();
  useEffect(() => {
    let cancelled = false, running = false;
    async function load() {
      if (running) return;
      running = true;
      await Promise.allSettled([
        fetchMarketplaceListings({ mode: "featured" }).then(items => {
          if (!cancelled) { setProducts(items); setListingError(""); }
        }).catch(() => { if (!cancelled) setListingError("Could not refresh listings. Please try again."); })
          .finally(() => { if (!cancelled) setLoadingProducts(false); }),
        fetchMarketplaceListings({ mode: "auctions" }).then(items => {
          if (!cancelled) { setAuctions(items); setAuctionError(""); }
        }).catch(() => { if (!cancelled) setAuctionError("Could not load auctions. Please try again."); })
          .finally(() => { if (!cancelled) setLoadingAuctions(false); })
      ]);
      running = false;
    }
    load();
    const timer = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  return (
    <>
      <Header />

      <main>
        <section className="hero">
          <div className="container hero-inner">
            <div>
              <p className="eyebrow">🇵🇭 MADE FOR THE PHILIPPINES</p>

              <h1>
                Buy. Sell. <span>Connect.</span>
              </h1>

              <p className="lead">
                Discover great deals from sellers across the Philippines.
              </p>

              <div className="hero-actions">
                <Link className="primary" href="#browse">
                  Browse items
                </Link>

                <Link className="secondary" href="/sell">
                  {app?.isAdmin ? "Sell an item" : "Selling coming soon"}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <USAShoppingHero compact />

        <section id="categories" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <p className="eyebrow">EXPLORE</p>
                <h2>Shop by category</h2>
              </div>

              <Link href="#browse">View all</Link>
            </div>

            <div className="category-grid">
              {categories.map((category) => (
                <Link
                  key={category.name}
                  href={`/search?category=${encodeURIComponent(category.name)}`}
                  className="category-card"
                >
                  <span>{category.icon}</span>
                  <strong>{category.name}</strong>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="browse" className="section listings">
          <div className="container">
            <div className="section-head">
              <div>
                <p className="eyebrow">SHOP & BID</p>
                <h2>Featured items</h2>
              </div>

              <Link href="/search">See all items</Link>
            </div>

            {listingError && <p role="alert">{listingError}</p>}
            {loadingProducts ? (
              <p>Loading listings...</p>
            ) : listingError && products.length === 0 ? null : products.length === 0 ? (
              <div>
                <p>No listings yet.</p>
                <Link href="/sell">{app?.isAdmin ? "Be the first to list an item →" : "Selling coming soon →"}</Link>
              </div>
            ) : (
              <OrderedProductGrid products={products} />
            )}
          </div>
        </section>

        <section id="auctions" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <p className="eyebrow">BID & WIN</p>
                <h2>Auctions</h2>
              </div>

              <Link href="/auctions">View all auctions</Link>
            </div>

            {loadingAuctions ? <p>Loading auctions…</p> : auctionError ? <p role="alert">{auctionError}</p> : !auctions.length ? <p>No auctions yet.</p> :
              <div className="product-grid">{(now === null ? auctions : sortAuctionCards(auctions, now)).slice(0, 4)
                .map(auction => <AuctionCard key={auction.id} item={auction} />)}</div>}

          </div>
        </section>

        <section className="how">
          <div className="container">
            <p className="eyebrow">SIMPLE & EASY</p>
            <h2>How PinoyBuyNSell works</h2>

            <div className="steps">
              <div>
                <span>1</span>
                <h3>Find an item</h3>
                <p>Browse listings from sellers across the Philippines.</p>
              </div>

              <div>
                <span>2</span>
                <h3>Connect</h3>
                <p>View the listing and connect with the seller.</p>
              </div>

              <div>
                <span>3</span>
                <h3>Buy and bid</h3>
                <p>Connect with sellers about buying or bid on live auctions after approval.</p>
              </div>
            </div>
          </div>
        </section>
        <section className="website-offer" aria-labelledby="website-offer-title">
          <div className="container website-offer-panel">
            <div>
              <p className="eyebrow">YOUR NEXT IDEA STARTS HERE</p>
              <h2 id="website-offer-title">Want to build your own website?</h2>
              <p>Bring your business, portfolio, or next big idea online with Hostinger.</p>
              <p>Use our referral link for a special discount offer. Code: <strong className="website-offer-code">CU7JAYRGUJE4</strong></p>
              <small>Referral link. Available discounts and eligibility are shown by Hostinger.</small>
            </div>
            <a className="website-offer-button" href="https://www.hostinger.com/ph?REFERRALCODE=CU7JAYRGUJE4" target="_blank" rel="sponsored noopener noreferrer">
              Build your website with Hostinger <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer">
          <div>
            <SiteLogo footer />

            <p>Your Philippine online marketplace.</p>
            <div className="facebook-links">
              <a href={facebookPageUrl} target="_blank" rel="noopener noreferrer">Follow us on Facebook ↗</a>
              <a href={messengerUrl} target="_blank" rel="noopener noreferrer">Message us on Messenger ↗</a>
            </div>
          </div>

          <div><Link href="/prohibited-items">Prohibited items policy</Link><p><Link href="/payment-rules">Payment &amp; returns</Link></p><p>© 2026 PinoyBuyNSell</p></div>
        </div>
      </footer>
    </>
  );
}
