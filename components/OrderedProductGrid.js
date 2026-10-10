"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ProductCard from "./ProductCard";
import useMarketplaceClock from "./useMarketplaceClock";
import { listingAvailability, sortMarketplaceListings } from "@/lib/listing-order.mjs";

export default function OrderedProductGrid({ products, refreshOnExpiry = false }) {
  const now = useMarketplaceClock();
  const router = useRouter();
  const previous = useRef(null);
  const ids = products.map(p => String(p.id)).join("|");
  const signature = now === null ? null : products.map(p => listingAvailability(p, now).state).join("|");
  useEffect(() => {
    if (signature === null) return;
    if (refreshOnExpiry && previous.current?.ids === ids && previous.current.signature !== signature) router.refresh();
    previous.current = { ids, signature };
  }, [signature, ids, refreshOnExpiry, router]);
  const ordered = now === null ? products : sortMarketplaceListings(products, now);
  return <div className="product-grid">{ordered.map(product => <ProductCard key={product.id} product={product} />)}</div>;
}
