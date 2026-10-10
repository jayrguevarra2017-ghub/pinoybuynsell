"use client";
import Link from "next/link";
import AuctionCountdown from "./AuctionCountdown";
import ListingPhoto from "./ListingPhoto";
import { peso } from "@/lib/data";
import ListingLike from "./ListingLike";
import useMarketplaceClock from "./useMarketplaceClock";
import { auctionCardAvailability } from "@/lib/listing-order.mjs";

export default function AuctionCard({ item: auction }) {
  const now = useMarketplaceClock();
  if (!auction) return null;
  const availability = auctionCardAvailability(auction, now ?? (Date.parse(auction.created_at) || 0));
  return (
  
   <article className="auction-card">
      <div className="listing-card-media"><Link href={`/product/${auction.productId}`} className="auction-image"><ListingPhoto product={{ ...auction, image_path: auction.imagePath }} fit="contain" /><b>{now === null && auction.status === "active" && auction.productStatus !== "sold" ? "AUCTION" : availability.label.toUpperCase()}</b></Link><ListingLike listingId={auction.productId} title={auction.title} overlay /></div>
      <Link href={`/product/${auction.productId}`} className="auction-info"><p className="category-label">Auction</p><h3>{auction.title}</h3><div className="auction-bid"><div><small>{availability.rank === 2 ? "Last bid" : "Current bid"}</small><strong>{peso(auction.currentBid ?? 0)}</strong></div><div className="auction-time"><AuctionCountdown endTime={auction.endTime} startsAt={auction.startTime} status={auction.productStatus === "sold" ? "ended" : auction.status ?? "active"} showLabel /></div></div><p className="auction-meta">📍 {auction.location}{auction.bids != null && <> &nbsp; • &nbsp; {auction.bids} bids</>}</p></Link>
    </article>
  );
}
