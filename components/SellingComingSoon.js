import Link from "next/link";
import { sellingComingSoon } from "@/lib/selling-access.mjs";

export default function SellingComingSoon() {
  return <section className="selling-coming-soon" aria-labelledby="selling-coming-soon-title">
    <p className="eyebrow">COMING SOON</p>
    <h2 id="selling-coming-soon-title">Selling coming soon</h2>
    <p>{sellingComingSoon}</p>
    <p>You can browse available items, contact sellers about buying, and bid on live auctions after ID approval.</p>
    <div className="listing-share-actions"><Link className="view inline" href="/search">Browse items</Link>
      <Link className="view inline" href="/auctions">Explore auctions</Link></div>
  </section>;
}
