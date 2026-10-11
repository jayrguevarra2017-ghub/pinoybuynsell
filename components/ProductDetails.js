"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ListingGallery from "@/components/ListingGallery";
import ListingShare from "@/components/ListingShare";
import ShippingDetails from "@/components/ShippingDetails";
import PaymentRules from "@/components/PaymentRules";
import ListingAvailability from "@/components/ListingAvailability";
import AuctionCountdown from "@/components/AuctionCountdown";
import Header from "@/components/Header";
import SellerSummary from "@/components/SellerSummary";
import ListingLike from "@/components/ListingLike";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";
import { submitMarketplaceBid } from "@/lib/marketplace-bidding.mjs";
import { withDeadline } from "@/lib/verification-actions";
import { minimumMarketplaceBid, bidIncrementSettings } from "@/lib/bid-increments.mjs";

export default function ProductPage({ initialProduct = null }) {
  const params = useParams();
  const id = params?.id;
  const app = useApp();

  const [product, setProduct] = useState(initialProduct);
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(!initialProduct);
  const [errorMessage, setErrorMessage] = useState("");

  const user = app?.user ?? null, authReady = app?.authReady === true;
  const [bidAmount, setBidAmount] = useState("");
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidMessage, setBidMessage] = useState("");
  const [now, setNow] = useState(null);
  const bidLock = useRef(false), bidContext = useRef(null);
  bidContext.current = { id, userId: user?.id, auction, product, online: app?.online !== false };

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(timer); bidContext.current = null; };
  }, []);

  async function placeBid(event) {
    event.preventDefault();
    if (bidLock.current) return;
    setBidMessage("");
    if (app && !app.online) { setBidMessage("Reconnect to the internet before placing a bid."); return; }
    const snapshot = bidContext.current;
    if (!snapshot) return;
    bidLock.current = true;
    setSubmittingBid(true);
    try {
      const isCurrent = () => bidContext.current?.id === snapshot.id && bidContext.current?.userId === snapshot.userId
        && bidContext.current?.auction?.id === snapshot.auction?.id && bidContext.current?.online
        && bidContext.current?.product?.status === "active" && !bidContext.current?.product?.deleted_at;
      const data = await submitMarketplaceBid(supabase, { auction, product, user, amountText: bidAmount }, { isCurrent });
      if (!isCurrent()) return;
      setAuction(data);
      setBidAmount("");
      setBidMessage("Your bid was placed successfully.");
    } catch (error) {
      if (bidContext.current?.id === snapshot.id && bidContext.current?.userId === snapshot.userId)
        setBidMessage(error.message || "Could not confirm your bid. Refresh to check the current price before trying again.");
    } finally {
      bidLock.current = false;
      setSubmittingBid(false);
    }
  }

  const auctionOpen = now !== null && auction?.status === "active"
    && product?.status === "active" && product?.listing_type !== "fixed_price"
    && Date.parse(auction.ends_at) > now
    && (!auction.starts_at || Date.parse(auction.starts_at) <= now);
  let minimumBid = "", incrementLabel = "";
  if (auction) {
    try {
      minimumBid = minimumMarketplaceBid(auction, product);
      const increment = bidIncrementSettings(product);
      incrementLabel = `₱${Number(increment.value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch { /* Do not accept a bid with invalid terms or above the supported maximum. */ }
  }

  useEffect(() => {
    if (!id) return;
    let active = true;

    async function loadProduct() {
      const seed = initialProduct && String(initialProduct.id) === String(id) ? initialProduct : null;
      setLoading(!seed);
      setErrorMessage("");

      setProduct(seed);
      setAuction(null);
      setBidMessage(""); setBidAmount("");

      try {
        const { data, error } = await withDeadline(supabase
          .from("products")
          .select(
            "*"
          )
          .eq("id", id)
          .in("status", ["active", "sold"])
          .is("deleted_at", null)
          .maybeSingle());

        if (!active) return;

        if (error) {
          console.error("Product load error:", error);
          setErrorMessage("Item details could not be loaded. Please refresh to try again.");
          return;
        }

        if (!data || !["active", "sold"].includes(data.status) || data.deleted_at) { setProduct(null); setErrorMessage("This listing is unavailable."); return; }
        setProduct(data);

        if (data.listing_type === "fixed_price") return;

        const { data: auctionData, error: auctionError } = await withDeadline(supabase
          .from("auctions")
          .select(
            "id, product_id, starting_price, current_bid, starts_at, ends_at, status, created_at"
          )
          .eq("product_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle());

        if (!active) return;

        if (auctionError) {
          console.error("Auction load error:", auctionError);
          setErrorMessage("Auction details could not be loaded. Please refresh to try again.");
        } else {
          setAuction(auctionData);
        }
      } catch (error) {
        if (!active) return;
        console.error("Item load error:", error);
        setErrorMessage("Item details could not be loaded. Please refresh to try again.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProduct();
    return () => { active = false; };
  }, [id, initialProduct]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="page">
          <div className="container">
            <h1>Loading item...</h1>
          </div>
        </main>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header />
        <main className="page">
          <div className="container">
            <h1>Item not found</h1>

            {errorMessage && (
              <p style={{ marginTop: "15px" }}>
                Error: {errorMessage}
              </p>
            )}

            <Link className="view inline" href="/">
              ← Back home
            </Link>
          </div>
        </main>
      </>
    );
  }

  const isAuction = product.listing_type === "auction" || Boolean(auction);
  const priceLabel = isAuction ? (auction ? "Current bid" : "Starting bid") : "Price";
  const price = isAuction ? (auction?.current_bid ?? auction?.starting_price ?? product.auction_starting_price) : product.price;
  return <>
    <Header />
    <main className="page listing-detail-page">
      <div className="container">
        <Link href="/search" className="back">← Back to marketplace</Link>
        <div className="listing-detail-layout">
          <ListingGallery product={product} />
          <div className="listing-purchase-panel">
            <p className="eyebrow">{isAuction ? "BID & WIN" : "FIND YOUR NEXT FAVORITE"}</p>
            <h1>{product.title}</h1>
            <ListingLike key={`${product.id}:${app?.user?.id || "guest"}`} listingId={product.id} title={product.title} />
            <SellerSummary key={`${product.seller_id}:${app?.user?.id || "guest"}`} sellerId={product.seller_id} />
            <div className="listing-summary-tags"><span>{isAuction ? "Auction / bidding" : "Fixed price"}</span>
              {product.condition && <span>{product.condition}</span>}<span>📍 {product.location || "Philippines"}</span></div>
            {errorMessage && <p role="alert">{errorMessage}</p>}
            <div className="listing-price-block"><span>{priceLabel}</span>
              <strong>{price != null ? `₱${Number(price).toLocaleString("en-PH")}` : "Checking auction price…"}</strong>
              {isAuction && <p className="muted">Seller’s reference item value: ₱{Number(product.price).toLocaleString("en-PH")}</p>}
            </div>
            <PaymentRules />
            {isAuction && <div className="auction-countdown-panel">
              <AuctionCountdown endTime={auction?.ends_at ?? product.auction_ends_at} startsAt={auction?.starts_at}
                status={product.status === "active" ? (auction?.status ?? "active") : "ended"} showLabel />
            </div>}
            {auction && (
              <div className="listing-bid-panel">
                <p className="eyebrow">{auctionOpen ? "LIVE AUCTION" : "AUCTION"}</p>

                <p>
                  <strong>Starting Price:</strong> ₱
                  {Number(auction.starting_price ?? 0).toLocaleString("en-PH")}
                </p>

                <p>
                  <strong>Auction Ends (Philippine time):</strong>{" "}
                  {auction.ends_at
                    ? new Date(auction.ends_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })
                    : "Not set"}
                </p>
                {!authReady ? <p>Checking sign-in...</p> : !auctionOpen ? (
                  <p>This auction is not open for bidding.</p>
                ) : !user ? (
                  <Link className="view" href="/login">Sign in to place a bid</Link>
                ) : user.id === product.seller_id ? (
                  <p>You cannot bid on your own listing.</p>
                ) : !minimumBid ? (
                  <p>Bidding is unavailable for these auction terms. Please contact the administrator.</p>
                ) : (
                  <form className="listing-form" onSubmit={placeBid}>
                    <label htmlFor="bid-amount">Your bid (₱)
                      <input id="bid-amount" type="number" inputMode="decimal" step="0.01"
                        min={minimumBid}
                        required value={bidAmount} onChange={(event) => setBidAmount(event.target.value)}
                        disabled={submittingBid || app?.online === false} />
                    </label>
                    <p>Minimum increase: {incrementLabel}. Your next bid must be at least <strong>₱{Number(minimumBid).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.{" "}
                      You may bid more. Bids are recorded when submitted.</p>
                    <Link href="/verify">ID verification is required before bidding</Link>
                    <button className="sell" type="submit" disabled={submittingBid || app?.online === false}>
                      {submittingBid ? "Placing bid..." : "Place bid"}
                    </button>
                  </form>
                )}
                {bidMessage && <p role="status" aria-live="polite">{bidMessage}</p>}
              </div>
            )}

            <ListingAvailability key={product.id} product={product} />
            <section className="listing-shipping" aria-label="Shipping details"><h2>Shipping</h2>
              <ShippingDetails product={product} /><p className="muted">Shipping is separate from the item price or winning bid.</p>
            </section>
            <ListingShare id={product.id} product={product} user={user} />
          </div>
        </div>
        <div className="listing-details-bottom">
          <section className="listing-description"><p className="eyebrow">A CLOSER LOOK</p><h2>About this item</h2>
            <p>{product.description || "The seller has not added a description."}</p>
          </section>
          <section className="listing-specifics"><h2>Item details</h2><dl>
            <div><dt>Category</dt><dd>{product.category || "Not specified"}</dd></div>
            <div><dt>Condition</dt><dd>{product.condition || "Not specified"}</dd></div>
            <div><dt>Location</dt><dd>{product.location || "Philippines"}</dd></div>
            <div><dt>Selling format</dt><dd>{isAuction ? "Auction / bidding" : "Fixed price"}</dd></div>
            <div><dt>Listing number</dt><dd>{product.id}</dd></div>
          </dl></section>
        </div>
      </div>
    </main>
  </>;
}
