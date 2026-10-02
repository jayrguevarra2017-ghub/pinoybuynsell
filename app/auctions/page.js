import Header from "@/components/Header";
import AuctionCard from "@/components/AuctionCard";
import { auctions } from "@/lib/data";
export default function AuctionsPage(){return <><Header/><main className="page"><div className="container"><p className="eyebrow">BID & WIN</p><h1>Live Auctions</h1><p className="lead">Place bids on selected items and watch the countdown.</p><div className="auction-grid">{auctions.map(a=><AuctionCard key={a.id} auction={a}/>)}</div></div></main></>}
