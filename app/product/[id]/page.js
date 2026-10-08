"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ListingPhoto from "@/components/ListingPhoto";
import { listingShareUrl } from "@/lib/facebook";
import ShippingDetails from "@/components/ShippingDetails";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";

export default function ProductPage() {
  const params = useParams();
  const id = params?.id;

  const [product, setProduct] = useState(null);
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidMessage, setBidMessage] = useState("");
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => { clearInterval(timer); data.subscription.unsubscribe(); };
  }, []);

  async function placeBid(event) {
    event.preventDefault();
    if (submittingBid) return;
    setBidMessage("");
    const amount = Number(bidAmount);
    const current = Math.max(Number(auction?.current_bid ?? 0), Number(auction?.starting_price ?? 0));
    if (!/^\d+(\.\d{1,2})?$/.test(bidAmount) || !Number.isFinite(amount) || amount <= current) {
      setBidMessage("Enter a bid higher than the current bid, with up to two decimal places.");
      return;
    }
    const verification = await supabase.rpc("is_marketplace_verified");
    if (verification.error || !verification.data) {
      setBidMessage("Submit your ID and wait for administrator approval before bidding.");
      return;
    }
    setSubmittingBid(true);
    try {
      const { data, error } = await supabase.rpc("place_marketplace_bid", {
        p_auction_id: String(auction.id), p_amount: amount,
      });
      if (error) {
        setBidMessage(error.code === "PGRST202"
          ? "Bidding is not available yet. Please try again later."
          : error.message);
        return;
      }
      setAuction(data);
      setBidAmount("");
      setBidMessage("Your bid was placed successfully.");
    } catch {
      setBidMessage("Could not confirm your bid. Refresh to check the current price before trying again.");
    } finally {
      setSubmittingBid(false);
    }
  }

  const auctionOpen = now !== null && auction?.status === "active"
    && Date.parse(auction.ends_at) > now
    && (!auction.starts_at || Date.parse(auction.starts_at) <= now);

  useEffect(() => {
    if (!id) return;

    async function loadProduct() {
      setLoading(true);
      setErrorMessage("");

      setProduct(null);
      setAuction(null);

      try {
        const { data, error } = await supabase
          .from("products")
          .select(
            "*"
          )
          .eq("id", id)
          .single();

        if (error) {
          console.error("Product load error:", error);
          setErrorMessage(error.message);
          return;
        }

        if (data?.deleted_at) { setErrorMessage("This listing has been removed."); return; }
        setProduct(data);

        const { data: auctionData, error: auctionError } = await supabase
          .from("auctions")
          .select(
            "id, product_id, starting_price, current_bid, starts_at, ends_at, status, created_at"
          )
          .eq("product_id", id)
          .eq("status", "active")
          .maybeSingle();

        if (auctionError) {
          console.error("Auction load error:", auctionError);
          setErrorMessage("Auction details could not be loaded. Please refresh to try again.");
        } else {
          setAuction(auctionData);
        }
      } catch (error) {
        console.error("Item load error:", error);
        setErrorMessage("Item details could not be loaded. Please refresh to try again.");
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [id]);

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

  return (
    <>
      <Header />

      <main className="page">
        <div className="container narrow">
          <Link href="/" className="back">
            ← Back to marketplace
          </Link>

          <div
            style={{
              marginTop: "25px",
              padding: "28px",
              border: "1px solid #e5e7eb",
              borderRadius: "14px",
            }}
          >
            <p className="eyebrow">PINoyBuyNSell LISTING</p>

            <ListingPhoto product={product} detail />

            <h1>{product.title}</h1>
            <a className="facebook-share" href={listingShareUrl(product.id)} target="_blank" rel="noopener noreferrer">Share this item on Facebook ↗</a>

            {errorMessage && <p role="alert">{errorMessage}</p>}

            <h2 style={{ marginTop: "15px" }}>
              ₱{Number(product.price).toLocaleString("en-PH")}
            </h2>

            <div style={{ marginTop: "25px" }}>
              <p>
                <strong>Category:</strong> {product.category}
              </p>

              <p>
                <strong>Condition:</strong> {product.condition}
              </p>

              <p>
                <strong>Location:</strong> {product.location}
              </p>

              <p>
                <strong>Status:</strong> {product.status}
              </p>
            </div>
            <section aria-label="Shipping details">
              <h3>Shipping</h3>
              <ShippingDetails product={product} />
              <p>Shipping is charged separately from the item price or winning bid.</p>
            </section>
{auction && (
  <div
    style={{
      marginTop: "30px",
      padding: "20px",
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
    }}
  >
    <p className="eyebrow">LIVE AUCTION</p>

    <h3 style={{ marginTop: "10px" }}>
      Current Bid: ₱
      {Number(
        auction.current_bid ?? auction.starting_price ?? 0
      ).toLocaleString("en-PH")}
    </h3>

    <p>
      <strong>Starting Price:</strong> ₱
      {Number(auction.starting_price ?? 0).toLocaleString("en-PH")}
    </p>

    <p>
      <strong>Auction Ends:</strong>{" "}
      {auction.ends_at
        ? new Date(auction.ends_at).toLocaleString("en-PH")
        : "Not set"}
    </p>
    {!authReady ? <p>Checking sign-in...</p> : !user ? (
      <Link className="view" href="/login">Sign in to place a bid</Link>
    ) : user.id === product.seller_id ? (
      <p>You cannot bid on your own listing.</p>
    ) : !auctionOpen ? (
      <p>This auction is not open for bidding.</p>
    ) : (
      <form className="listing-form" onSubmit={placeBid}>
        <label htmlFor="bid-amount">Your bid (₱)
          <input id="bid-amount" type="number" inputMode="decimal" step="0.01"
            min={(Math.max(Number(auction.current_bid ?? 0), Number(auction.starting_price ?? 0)) + 0.01).toFixed(2)}
            required value={bidAmount} onChange={(event) => setBidAmount(event.target.value)}
            disabled={submittingBid} />
        </label>
        <p>Enter an amount higher than the current bid. Bids are recorded when submitted.</p>
        <Link href="/verify">ID verification is required before bidding</Link>
        <button className="sell" type="submit" disabled={submittingBid}>
          {submittingBid ? "Placing bid..." : "Place bid"}
        </button>
      </form>
    )}
    {bidMessage && <p role="status" aria-live="polite">{bidMessage}</p>}
  </div>
)}
            <div style={{ marginTop: "30px" }}>
              <h3>Description</h3>
              <p style={{ marginTop: "10px" }}>
                {product.description}
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
