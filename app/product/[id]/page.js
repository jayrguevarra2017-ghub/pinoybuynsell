import Header from "@/components/Header";
import Link from "next/link";
import { products, auctions, peso } from "@/lib/data";

export default async function ProductPage({ params }) {
  const item = [...products, ...auctions].find(x => x.id === params.id);
  if (!item) return <><Header/><main className="page"><div className="container"><h1>Item not found</h1><Link className="view inline" href="/">← Back home</Link></div></main></>;
  const isAuction = "currentBid" in item;
  return <><Header/><main className="page"><div className="container detail"><Link href="/" className="back">← Back to marketplace</Link><div className="detail-grid"><div className="detail-image">{item.icon}</div><div><p className="eyebrow">{isAuction ? "LIVE AUCTION" : item.condition}</p><h1>{item.title}</h1><div className="detail-price">{peso(isAuction ? item.currentBid : item.price)}</div><p>📍 {item.location}</p>{isAuction && <p className="muted">Current bid • {item.bids} bids</p>}<button className="sell big">{isAuction ? "Place a bid" : "Contact seller"}</button></div></div></div></main></>;
}
