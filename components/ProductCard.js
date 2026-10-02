import Link from "next/link";
import { peso } from "@/lib/data";

export default function ProductCard({ product }) {
  return (
    <article className="product">
      <Link href={`/product/${product.id}`} className="product-image"><span>{product.icon}</span><b>{product.condition}</b></Link>
      <div className="product-body"><p className="category-label">{product.category}</p><h3>{product.title}</h3><strong className="price">{peso(product.price)}</strong><p>📍 {product.location}</p><Link className="view" href={`/product/${product.id}`}>View item</Link></div>
    </article>
  );
}
