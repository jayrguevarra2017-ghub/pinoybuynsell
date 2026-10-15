import ProductDetails from "@/components/ProductDetails";
import { getPublicPreviewProduct, productPreviewMetadata } from "@/lib/product-metadata.mjs";
import { cache } from "react";
import { notFound } from "next/navigation";
import { breadcrumbs, productStructuredData, serializeJsonLd } from "@/lib/seo.mjs";

export const dynamic = "force-dynamic";
const readProduct = cache(id => getPublicPreviewProduct(id, { env: process.env, failOnError: true, includeSold: true }));

export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await readProduct(id);
  if (!product) notFound();
  return productPreviewMetadata(id, product, process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export default async function ProductPage({ params }) {
  const { id } = await params;
  const product = await readProduct(id);
  if (!product) notFound();
  const metadata = productPreviewMetadata(id, product, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const structured = productStructuredData(id, product, metadata);
  const trail = product?.category === "Collectibles" ? breadcrumbs([{ name: "Home", path: "/" }, { name: "Trading cards & collectibles", path: "/collectibles" }, { name: product.title, path: `/product/${id}` }]) : null;
  return <>{structured && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structured) }} />}{trail && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(trail) }} />}<ProductDetails initialProduct={product} /></>;
}
