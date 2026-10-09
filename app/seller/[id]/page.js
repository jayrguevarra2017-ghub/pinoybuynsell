import SellerProfile from "@/components/SellerProfile";
import { validSellerId } from "@/lib/seller-community.mjs";
import { publicPageMetadata } from "@/lib/seo.mjs";

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { ...publicPageMetadata({ path: `/seller/${encodeURIComponent(id)}`, title: "Seller profile | PinoyBuyNSell",
    description: "Browse this seller’s listings, follow their account and read community recommendations on PinoyBuyNSell." }),
    robots: { index: false, follow: true } };
}

export default async function Page({ params }) {
  const { id } = await params;
  return <SellerProfile sellerId={validSellerId(id) ? id : ""} />;
}
