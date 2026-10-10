import { getBrowseListings, getFeaturedListings, getPublicAuctionCards } from "@/lib/public-listings.mjs";
import { validSellerId } from "@/lib/seller-community.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const params = new URL(request.url).searchParams, mode = params.get("mode") || "browse", sellerId = params.get("seller") || "";
  const page = Number(params.get("page") || 1);
  if (!["browse", "featured", "auctions"].includes(mode) || !Number.isInteger(page) || page < 1 || page > 1000 || (sellerId && !validSellerId(sellerId)))
    return Response.json({ message: "Invalid listing request." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const options = { env: process.env };
    const items = mode === "featured" ? await getFeaturedListings(options)
      : mode === "auctions" ? await getPublicAuctionCards(options, Date.now(), page)
        : await getBrowseListings({ page, sellerId, category: (params.get("category") || "").slice(0, 150), query: (params.get("q") || "").slice(0, 150) }, options);
    return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "Listings could not be loaded. Please refresh to try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
