import Link from "next/link";
import Header from "@/components/Header";

export default function ListingNotFound() {
  return <><Header/><main className="page"><div className="container narrow">
    <h1>This listing is unavailable</h1><p>It may have ended, sold or been removed. Browse the marketplace for other items.</p>
    <Link className="view" href="/collectibles">Trading cards &amp; collectibles</Link>
    <Link className="view" href="/search">Browse all items</Link>
  </div></main></>;
}
