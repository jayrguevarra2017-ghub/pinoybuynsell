"use client";
import Link from "next/link";
import Header from "@/components/Header";

export default function CollectiblesError({ reset }) {
  return <><Header/><main className="page"><div className="container narrow">
    <h1>Collectibles are temporarily unavailable</h1>
    <p>The listing service could not be reached. Try loading the page again.</p>
    <button type="button" className="view" onClick={reset}>Try loading collectibles again</button>
    <Link className="view" href="/search">Browse the marketplace</Link>
  </div></main></>;
}
