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
        <span>{product.icon || "🛍️"}</span>
        <b>{product.condition || "Item"}</b>
      </Link>

      <div className="product-body">
        <p className="category-label">
          {product.category || "Other"}
        </p>

        <h3>{product.title || "Untitled item"}</h3>

        <strong className="price">
          {peso(product.price || 0)}
        </strong>

        <p>
          📍 {product.location || "Philippines"}
        </p>

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
