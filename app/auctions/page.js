import AuctionsPage from "@/components/AuctionsPage";
import { publicPageMetadata } from "@/lib/seo.mjs";
import { getPublicAuctionCards } from "@/lib/public-listings.mjs";

export const dynamic = "force-dynamic";

export const metadata = publicPageMetadata({ path: "/auctions", title: "Online Auctions in the Philippines | PinoyBuyNSell",
  description: "Discover active item auctions in the Philippines, view current bids and closing times, and sign in with an approved account to place a bid." });

export default async function Page() {
  let auctions = null;
  try { auctions = await getPublicAuctionCards({ env: process.env }); } catch { /* Browser retries current bids. */ }
  return <AuctionsPage initialAuctions={auctions} />;
}
