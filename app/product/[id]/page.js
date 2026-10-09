import ProductDetails from "@/components/ProductDetails";
import { getPublicPreviewProduct, productPreviewMetadata } from "@/lib/product-metadata.mjs";
import { cache } from "react";
import { productStructuredData, serializeJsonLd } from "@/lib/seo.mjs";

export const dynamic = "force-dynamic";
const readProduct = cache(id => getPublicPreviewProduct(id, { env: process.env }));

export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await readProduct(id);
  return productPreviewMetadata(id, product, process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export default async function ProductPage({ params }) {
  const { id } = await params;
  const product = await readProduct(id);
  const metadata = productPreviewMetadata(id, product, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const structured = productStructuredData(id, product, metadata);
  return <>{structured && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structured) }} />}<ProductDetails initialProduct={product} /></>;
}
