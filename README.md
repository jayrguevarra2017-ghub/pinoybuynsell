# PinoyBuyNSell

Initial Next.js App Router marketplace prototype for Hostinger.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Production

```bash
npm run build
npm start
```

The auction countdown is intentionally client-updated after mount so it does not cause an SSR hydration mismatch.

## Search engine visibility

Public homepage listings, Browse results, active auction cards and item details are rendered on the server so crawlers can read them without JavaScript. Only public, active, undeleted listing fields are fetched with the Supabase anonymous key; this does not bypass database access rules. Browse queries the real marketplace instead of sample products.

- `/sitemap.xml` includes the public pages and active listings, with paginated Supabase reads. Database failures fail the request rather than publishing an empty sitemap. A sitemap index will be needed before reaching 45,000 active listings.
- `/robots.txt` links to the sitemap. Account, admin, sign-in, ID verification and seller forms also carry `noindex` metadata. Authentication and database policies still control access.
- Public pages have descriptive titles, descriptions and canonical URLs. Filtered search and pagination URLs use `noindex,follow` to limit duplicate search results.
- Item pages include safe structured data. Fixed-price listings with a valid purchase price use Product data, PHP offers and current stock. Auctions and listings without a purchase price use WebPage data, so Google isn't given an incomplete Product snippet. Auction reference values are never advertised as purchase prices. Ratings, reviews and delivery promises are not fabricated.

After Hostinger deploys the changes:

1. Open Google Search Console at https://search.google.com/search-console and add the Domain property `pinoybuynsell.com`.
2. Copy Google's verification TXT record into the domain's DNS zone at its DNS provider (Hostinger if it manages the domain's nameservers), then verify in Search Console. Preserve existing DNS records.
3. Under Sitemaps, submit `https://pinoybuynsell.com/sitemap.xml`.
4. Use URL Inspection to inspect the homepage and an active product URL, run the live test, and request indexing if eligible. Monitor Page indexing and Performance for actual crawl/search results.

Search Console and organic listing submission are free. These changes improve crawlability; Google decides whether to index pages and their rankings. Publish accurate, original item descriptions and photos, keep availability current, and earn relevant links from your Facebook Page and other trusted sites. Recrawling and ranking changes take time and do not guarantee a first-place result.

## Next development stages

- Database and real product listings
- User authentication
- Seller profiles
- Image uploads
- Search/filtering
- Buyer/seller messaging
- Real bidding and payments
- Admin dashboard
