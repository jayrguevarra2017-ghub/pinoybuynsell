import ProductDetails from "@/components/ProductDetails";
import { getPublicPreviewProduct, productPreviewMetadata } from "@/lib/product-metadata.mjs";
import { cache } from "react";
import { productStructuredData, serializeJsonLd } from "@/lib/seo.mjs";

export const dynamic = "force-dynamic";
const readProduct = cache(id => getPublicPreviewProduct(id, { env: process.env }));

export async function generateMetadata({ params }) {
  const product = await readProduct(params.id);
  return productPreviewMetadata(params.id, product, process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export default async function ProductPage({ params }) {
  const product = await readProduct(params.id);
  const metadata = productPreviewMetadata(params.id, product, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const structured = productStructuredData(params.id, product, metadata);
  return <>{structured && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structured) }} />}<ProductDetails initialProduct={product} /></>;
}
