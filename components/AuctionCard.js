import Link from "next/link";
import AuctionCountdown from "./AuctionCountdown";
import { peso } from "@/lib/data";

export default function AuctionCard({ auction }) {
  return (
    <Link href={`/product/${auction.id}`} className="auction-card">
      <div className="auction-image"><span>{auction.icon}</span><b>LIVE AUCTION</b></div>
      <div className="auction-info"><p className="category-label">Auction</p><h3>{auction.title}</h3><div className="auction-bid"><div><small>Current bid</small><strong>{peso(auction.currentBid)}</strong></div><div className="auction-time"><small>Ends in</small><AuctionCountdown endTime={auction.endTime} /></div></div><p className="auction-meta">📍 {auction.location} &nbsp; • &nbsp; {auction.bids} bids</p></div>
    </Link>
  );
}
