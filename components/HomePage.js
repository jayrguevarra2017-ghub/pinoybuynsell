"use client";
import SiteLogo from "@/components/SiteLogo";

import { useEffect, useState } from "react";
import Link from "next/link";
import { facebookPageUrl, messengerUrl } from "@/lib/facebook";
import USAShoppingHero from "@/components/USAShoppingHero";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import AuctionCard from "@/components/AuctionCard";
import { categories } from "@/lib/data";
import { supabase } from "@/lib/supabase";

export default function HomePage({ initialProducts = null }) {
  const [products, setProducts] = useState(initialProducts || []);
  const [loadingProducts, setLoadingProducts] = useState(initialProducts === null);
  const [auctions, setAuctions] = useState([]);
  const [loadingAuctions, setLoadingAuctions] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase
        .from("products")
        .select(
          "*, auctions(starts_at,ends_at,status,created_at)"
        )
        .eq("status", "active")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) {
        console.error("Product load error:", error);
        setProducts([]);
      } else {
        setProducts(data || []);
      }

      setLoadingProducts(false);
    }    async function loadAuctions() {
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          id,
          product_id,
          starting_price,
          current_bid,
          starts_at,
          ends_at,
          status,
          created_at,
          products!inner (
            id,
            title,
            image_path,
            category,
            location
          )
        `)
        .eq("status", "active")
        .is("products.deleted_at", null)
        .eq("products.status", "active")
        .gt("ends_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(4);

      if (error) {
        console.error("Auction load error:", error);
        setAuctions([]);
      } else {
        const formattedAuctions = (data || []).map((auction) => ({
          id: auction.id,
          productId: auction.product_id,
          title: auction.products?.title || "Auction item",
          imagePath: auction.products?.image_path,
          category: auction.products?.category || "Auction",
          location: auction.products?.location || "Philippines",
          currentBid: auction.current_bid ?? auction.starting_price ?? 0,
          startTime: auction.starts_at,
          status: auction.status,
          endTime: auction.ends_at,
          icon: "🏷️"
        }));

        setAuctions(formattedAuctions);
      }

      setLoadingAuctions(false);
    }

     loadProducts();
    loadAuctions();
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
                  Sell an item
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
                <p className="eyebrow">JUST LISTED</p>
                <h2>Featured items</h2>
              </div>

              <Link href="/search">See all items</Link>
            </div>

            {loadingProducts ? (
              <p>Loading listings...</p>
            ) : products.length === 0 ? (
              <div>
                <p>No active listings yet.</p>
                <Link href="/sell">Be the first to list an item →</Link>
              </div>
            ) : (
              <div className="product-grid">
               {(products || [])
  .filter((product) => product && product.id)
  .map((product) => (
    <ProductCard key={product.id} product={product} />
  ))}
              </div>
            )}
          </div>
        </section>

        <section id="auctions" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <p className="eyebrow">BID & WIN</p>
                <h2>Live auctions</h2>
              </div>

              <Link href="/auctions">View all auctions</Link>
            </div>

            <div className="product-grid">
  {(auctions || [])
    .filter((auction) => auction && auction.id)
    .slice(0, 4)
    .map((auction) => (
      <AuctionCard key={auction.id} item={auction} />
    ))}
</div>
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
                <h3>Buy or sell</h3>
                <p>Make deals and list your own items for sale.</p>
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

          <div><Link href="/prohibited-items">Prohibited items policy</Link><p>© 2026 PinoyBuyNSell</p></div>
        </div>
      </footer>
    </>
  );
}
