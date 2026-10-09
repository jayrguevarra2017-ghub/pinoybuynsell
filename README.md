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

## Seller following and customer recommendations

Apply `supabase/migrations/202610100013_seller_following_and_recommendations.sql` once in Supabase SQL Editor after the existing migrations, then deploy the website. This is an additive migration and preserves existing listings, auctions and Facebook posts. It needs no new Hostinger environment variables. The connected data API cannot run database schema migrations, so SQL Editor activation is required.

Each item links to `/seller/SELLER_UUID`, where visitors can browse that seller's active listings and community recommendations. Signed-in users can follow/unfollow sellers; My Account shows their private followed-seller list and, for sellers with public listings, their own public profile link. Only aggregate follower counts are public. Public seller and recommendation author names use the account username, with a generic fallback, never the legal name, phone or email.

Approved accounts can write one positive recommendation per other seller (10–1,000 Unicode characters), edit it or remove it. Sellers cannot recommend/follow themselves, change another member's comment or see who follows them. Removing one's own recommendation remains possible if ID approval later changes. Recommendations are community experiences, not verified purchase reviews; there is no checkout/order proof or automatic notification. They are not used as product ratings in structured data.

All reads/writes use narrowly scoped database functions. The new RLS-enabled tables have no direct browser grants; mutation functions derive identity from the verified Supabase session and check self-action, seller availability, ID approval and content length. Public functions expose only approved public fields. The existing private account fields and tables are unchanged. Profile listings and recommendations paginate. Missing schema and network failures display an unavailable message instead of invented counts; mutations have bounded waits, offline controls and double-click guards.

Validation: all 81 automated tests and the production build passed. A local PostgreSQL-compatible database passed 59 access, privacy and mutation checks. Mocked browser checks passed following across profiles/accounts, recommendation create/edit/remove, escaped text, sign-in/owner/approval restrictions, missing-schema handling, deadlines, pagination and 320/390/1280 layouts. No hosted follows/recommendations were written during validation. After migration and deployment, use an approved second account to follow a seller, add/edit/remove a recommendation, and confirm the public profile and private following list update.

## Listing photos and Facebook sharing

Auction cards on Home and Auctions use the listing's public cover photo, with an icon when no photo is attached. Item pages use an original PinoyBuyNSell layout with a large photo, thumbnail navigation, enlarged photo dialog, pricing/bidding, stock options, shipping, description and item details. Desktop places photos beside the details; phones stack them. No seller ratings, views, favorites or purchase protections are invented.

New and edited listings accept up to eight optional JPEG, PNG, WebP, HEIC or HEIF photos, up to 5 MB each. Sellers can append/remove photos and select the cover. Uploads inspect the actual file bytes rather than trusting the filename. HEIC/HEIF photos convert locally in a browser worker to JPEG before preview or upload, including HEIC files incorrectly named `.jpg`. The decoder loads only when needed. Converted images over 5 MB are resized and compressed to fit; unreadable files stop before any upload. The storage bucket continues to receive browser-compatible JPEG, PNG or WebP files.

To enable saving multiple photos, run `supabase/migrations/202610090012_listing_gallery.sql` once as a new Supabase SQL Editor query after prior migrations. It adds `products.image_paths` with a maximum of eight unique, seller-owned paths and enforces the first path as the existing `image_path` cover. Existing single-photo listings remain unchanged. Server reads fall back to the existing columns while this migration is pending, and single-photo saves still work. A multiple-photo save fails before uploading if the column is missing. Editing preserves existing photos unless removed; removed objects are retained because external posts or other references can still use them. Explicit failed saves clean up only newly uploaded objects; uncertain network outcomes retain them to protect a potentially successful save.

On October 9, 2026, listing 5's mislabeled HEIF photo was converted to a metadata-free JPEG in a new public storage object and only that listing's `image_path` was updated. Its original photo and auction terms were preserved.

Administrator-owned active listings offer **Post to PinoyBuyNSell Page**, which opens `/admin/facebook?listing=ID` for review and an explicit **Post to Facebook** click. This uses the existing server-side Page publisher instead of Facebook's general sharing composer. Opening the screen never posts automatically. General profile/group sharing and **Copy listing link** remain available; clipboard-denied browsers get a selectable link. Public visitors and other sellers do not get the Page-publishing action. Server authorization and ownership checks remain mandatory even if someone opens the URL directly.

The posting screen loads just the selected listing, shows published/failed/uncertain outcomes and links to confirmed Facebook posts. Status reads and session checks have deadlines, and posting responses are bounded through JSON parsing. Database operations in the server publisher have deadlines; expired-token, permission, image, publishing restriction and rate-limit errors give specific guidance without showing provider secrets. Unknown outcomes never retry automatically. Check the Page before posting: manual Facebook shares are not recorded by this publisher. The existing Hostinger Page credentials and SQL setup are reused; no new environment variables or migration are required.

For an outdated preview, enter the product URL in https://developers.facebook.com/tools/debug/ and choose **Scrape Again**. The website cannot confirm or cancel posts made through Facebook's external share composer. The direct Page publishing flow avoids that composer for eligible administrators; actual Meta publishing still depends on valid Page permissions and hosting credentials.

Validation for the October 9 gallery update: 64 automated tests, 50 local database checks, zero reported npm vulnerabilities, a production build, real HEIF conversion in Chromium, multi-photo mock create/edit flows, gallery keyboard/focus checks and mobile/desktop layouts. Browser writes and bids are mocked; no real Facebook post is sent. Read-only hosted checks confirmed the gallery column and validator are available; a signed-in seller smoke test and Hostinger deployment still need confirmation.

Validation for the October 10 sharing fix: 77 automated tests and a production build, plus browser checks for administrator ownership, selected-listing review without automatic posting, exactly one mock publish for duplicate clicks, saved-result displays, stale-processing protection, bounded status loading, invalid links and mobile/desktop layouts. Listing 5's public cover was verified as a real JPEG; its posting records were read without changing them. Live Hostinger HTML is inaccessible from this cloud network, and the hosting Page credentials are not injected here. A real Page post is therefore a user smoke test after Hostinger deploys; local browser publishing requests are intercepted and never sent to Meta.

## Next development stages

- Database and real product listings
- User authentication
- Seller profiles
- Image uploads
- Search/filtering
- Buyer/seller messaging
- Real bidding and payments
- Admin dashboard
