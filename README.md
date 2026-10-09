# PinoyBuyNSell

Initial Next.js App Router marketplace prototype for Hostinger.

## Run locally

```bash
npm ci
npm run dev
```

Then open http://localhost:3000.

## Production

```bash
npm run build
npm start
```

The auction countdown is intentionally client-updated after mount so it does not cause an SSR hydration mismatch.

## Runtime and dependency security

Use the latest patched Node.js 24 LTS release (preferred) or Node.js 22 LTS. `.nvmrc` selects Node 24 for local tools; Hostinger's deployed Node version must also be selected in its Node.js application settings. A Git push cannot confirm or update the hosting runtime by itself.

The dependency versions and `package-lock.json` are committed so deployments install the reviewed dependency tree with `npm ci`. On October 9, 2026, the vulnerable Next.js 14.2.15/PostCSS tree was replaced with Next.js 16.4.0 and PostCSS 8.5.23. React and React DOM are both 19.3.0; Supabase is pinned to 2.117.3. Product and search pages await route parameters as required by the updated framework.

Validation for that update: zero reported npm vulnerabilities, 49 passing tests, production builds on Node 24.19.0 and 24.21.0, and browser checks for mobile installation, navigation, offline recovery and bidding. HTTP checks cover product/search metadata, escaping user input, rejecting unauthorized publishing and keeping private keys out of browser assets. No database migration is needed.

Run `npm run check:security`, `npm test` and `npm run build` when updating dependencies. The audit checks currently published npm advisories; a clean result does not establish that the entire website or the hosting runtime is free of vulnerabilities. Keep Hostinger's runtime patched and review future dependency alerts. Never commit `.env` files or place private Supabase/Meta tokens in `NEXT_PUBLIC_*` variables.

## Installable mobile app (PWA)

The website installs as PinoyBuyNSell with the existing marketplace logo and opens in its own app window. It uses the same live accounts, ID approval, listings, bidding and USA shopping service. This build is a web app; it has not been submitted to Google Play or the App Store.

- Android: open `https://pinoybuynsell.com/` in Chrome, tap **Install app** on the website, then confirm the browser installation. Chrome's menu also offers **Install app** or **Add to Home screen** when available.
- iPhone/iPad: open the website in Safari → Share → **Add to Home Screen**. Enable **Open as Web App** if offered, then tap **Add**.
- Desktop Chrome/Edge: use the website's installation button or the install option in the browser's address bar/menu. Browser installation availability varies.

Mobile pages have Home, Browse, Sell, Auctions and Account navigation, with additional services in the header's Menu. The bottom bar and support popup leave space for the phone's safe area. The install guide disappears when the app is already running in standalone mode.

`/manifest.webmanifest` declares app identity, scope, shortcuts and a browser-compatible app icon made from the existing logo through Next's image optimizer, plus the original high-resolution logo. `/sw.js` caches only `/offline.html` and its public logo. Navigations always fetch current server HTML; no account HTML, product data, APIs, bids, photos, ID documents or messages are stored by the service worker or queued for later. Without a connection, full-page navigation opens the reconnect screen. Bidding is disabled when the browser reports offline. There are no push notifications in this version.

On future offline-shell changes, increment the service worker cache version. The worker updates with `updateViaCache: none`, and its HTTP response disables caching. It removes only this app's old offline-shell caches and never reloads a page automatically, protecting work in progress in forms.

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
