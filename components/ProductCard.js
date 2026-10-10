"use client";
import ListingPhoto from "@/components/ListingPhoto";
import ShippingDetails from "@/components/ShippingDetails";
import AuctionCountdown from "@/components/AuctionCountdown";
import Link from "next/link";
import { peso } from "@/lib/data";
import ListingLike from "@/components/ListingLike";
import useMarketplaceClock from "./useMarketplaceClock";
import { latestListingAuction, listingAvailability } from "@/lib/listing-order.mjs";

export default function ProductCard({ product }) {
  const now = useMarketplaceClock();
  if (!product) return null;
  const auction = latestListingAuction(product);
  const availability = listingAvailability(product, now ?? (Date.parse(product.created_at) || 0));

  return (
    <article className="product">
      <div className="listing-card-media"><Link
        href={`/product/${product.id}`}
        className="product-image"
      >
        <ListingPhoto product={product} />
        <b>{now === null && product.listing_type === "auction" && product.status !== "sold" ? "Auction" : availability.rank >= 1 ? availability.label : product.condition || "Item"}</b>
      </Link>
      <ListingLike listingId={product.id} title={product.title} overlay /></div>

      <div className="product-body">
        <p className="category-label">
          {product.category || "Other"}
        </p>
        {product.listing_type && <span className="listing-type-badge">{product.listing_type === "auction" ? "Auction / bidding" : "Fixed price"}</span>}

        <h3>{product.title || "Untitled item"}</h3>

        <strong className="price">
          {peso(product.price || 0)}
        </strong>
        {product.listing_type === "auction" ? <small>{now === null ? "Checking auction time…" : availability.state === "active" ? "Item value · open listing to bid" : availability.label}</small> : product.status !== "sold" && product.quantity != null &&
          <p className="stock-label">{Number(product.quantity) === 0 ? "Out of stock" : `${product.quantity} available`}{product.variations?.length ? ` · ${product.variations.length} variations` : ""}</p>}
        {product.listing_type === "auction" && <div className="listing-bid-countdown">
          <AuctionCountdown endTime={auction?.ends_at ?? product.auction_ends_at} startsAt={auction?.starts_at}
            status={product.status === "active" ? (auction?.status ?? "active") : "ended"} showLabel />
        </div>}

        <p>
          📍 {product.location || "Philippines"}
        </p>

        <ShippingDetails product={product} />

        <Link
          className="view"
          href={`/product/${product.id}`}
        >
          View item
        </Link>
      </div>
    </article>
  );
}
