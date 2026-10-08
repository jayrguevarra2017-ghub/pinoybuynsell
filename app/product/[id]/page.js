import ProductDetails from "@/components/ProductDetails";
import { getPublicPreviewProduct, productPreviewMetadata } from "@/lib/product-metadata.mjs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const product = await getPublicPreviewProduct(params.id, { env: process.env });
  return productPreviewMetadata(params.id, product, process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export default function ProductPage() {
  return <ProductDetails />;
}
