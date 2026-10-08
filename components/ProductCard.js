import ListingPhoto from "@/components/ListingPhoto";
import ShippingDetails from "@/components/ShippingDetails";
import Link from "next/link";
import { peso } from "@/lib/data";

export default function ProductCard({ product }) {
  if (!product) return null;

  return (
    <article className="product">
      <Link
        href={`/product/${product.id}`}
        className="product-image"
      >
        <ListingPhoto product={product} />
        <b>{product.condition || "Item"}</b>
      </Link>

      <div className="product-body">
        <p className="category-label">
          {product.category || "Other"}
        </p>
        {product.listing_type && <span className="listing-type-badge">{product.listing_type === "auction" ? "Auction / bidding" : "Fixed price"}</span>}

        <h3>{product.title || "Untitled item"}</h3>

        <strong className="price">
          {peso(product.price || 0)}
        </strong>
        {product.listing_type === "auction" ? <small>Item value · open listing to bid</small> : product.quantity != null &&
          <p className="stock-label">{product.quantity === 0 ? "Out of stock" : `${product.quantity} available`}{product.variations?.length ? ` · ${product.variations.length} variations` : ""}</p>}

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
