import Link from "next/link";
import AuctionCountdown from "./AuctionCountdown";
import ListingPhoto from "./ListingPhoto";
import { peso } from "@/lib/data";
import ListingLike from "./ListingLike";

export default function AuctionCard({ item: auction }) {
  if (!auction) return null;
  return (
  
   <article className="auction-card">
      <div className="listing-card-media"><Link href={`/product/${auction.productId}`} className="auction-image"><ListingPhoto product={{ ...auction, image_path: auction.imagePath }} fit="contain" /><b>LIVE AUCTION</b></Link><ListingLike listingId={auction.productId} title={auction.title} overlay /></div>
      <Link href={`/product/${auction.productId}`} className="auction-info"><p className="category-label">Auction</p><h3>{auction.title}</h3><div className="auction-bid"><div><small>Current bid</small><strong>{peso(auction.currentBid)}</strong></div><div className="auction-time"><AuctionCountdown endTime={auction.endTime} startsAt={auction.startTime} status={auction.status ?? "active"} showLabel /></div></div><p className="auction-meta">📍 {auction.location}{auction.bids != null && <> &nbsp; • &nbsp; {auction.bids} bids</>}</p></Link>
    </article>
  );
}
