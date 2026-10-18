import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import USAItemShare from "@/components/USAItemShare";
import { readPublicUSAItems } from "@/lib/public-usa-items.mjs";
import { usaItemMetadata, usaQuotePath, usaReferencePrice } from "@/lib/usa-item-sharing.mjs";
import { usaStoreLink } from "@/lib/usa-items.mjs";

export const dynamic = "force-dynamic";
const readItem = cache(async id => (await readPublicUSAItems({ env: process.env, itemId: id }))[0] || null);

export async function generateMetadata({ params }) {
  const { id } = await params;
  const item = await readItem(id);
  if (!item) notFound();
  return usaItemMetadata(item, process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export default async function USAItemPage({ params }) {
  const { id } = await params;
  const item = await readItem(id);
  if (!item) notFound();
  const metadata = usaItemMetadata(item, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const price = usaReferencePrice(item);
  return <><Header /><main className="page usa-shopping-page"><div className="container usa-item-detail">
    <Link className="back" href="/usa-shopping#usa-finds">← All USA finds</Link>
    <article className="usa-item-card">
      <div className="usa-item-photo">{metadata.openGraph.images[0] && <img src={metadata.openGraph.images[0].url} alt={item.title} />}</div>
      <div className="usa-item-copy"><p className="eyebrow">{item.store} · USA TO PHILIPPINES</p><h1>{item.title}</h1>
        {price && <p className="usa-item-price">Reference store price: {price} USD</p>}
        <p className="usa-item-full-description">{item.description}</p>
        <p>Request a delivered quote. Store prices and availability may change. Service fees, shipping and import charges are quoted separately.</p>
        <a className="view" href={usaStoreLink(item.item_url).href} target="_blank" rel="noopener noreferrer">View on {item.store} ↗</a>
        <Link className="usa-item-quote" href={usaQuotePath(item.id)}>Request a quote</Link>
        <USAItemShare item={item} />
      </div>
    </article>
  </div></main></>;
}
