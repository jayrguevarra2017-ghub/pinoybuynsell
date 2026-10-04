"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import AuctionCard from "@/components/AuctionCard";
import { categories, auctions } from "@/lib/data";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, seller_id, title, description, price, category, condition, location, status, created_at"
        )
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) {
        console.error("Product load error:", error);
        setProducts([]);
      } else {
        setProducts(data || []);
      }

      setLoadingProducts(false);
    }

    loadProducts();
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
                {products.map((product) => (
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
              {auctions.slice(0, 4).map((auction) => (
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
      </main>

      <footer>
        <div className="container footer">
          <div>
            <Link className="logo footer-logo" href="/">
              Pinoy<span>BuyNSell</span>
            </Link>

            <p>Your Philippine online marketplace.</p>
          </div>

          <p>© 2026 PinoyBuyNSell</p>
        </div>
      </footer>
    </>
  );
}
