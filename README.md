# PinoyBuyNSell

Initial Next.js App Router marketplace prototype for Hostinger.

## Administrator-only selling

For now, only trusted marketplace administrators can create or edit their own listings and upload listing photos through the website. Non-admin accounts, the selling page and navigation show **Selling coming soon**. Administrators retain selling and Facebook Page posting access; selling no longer requires their seller ID approval. Listing ownership, prohibited-items validation, shipping requirements and auction terms remain enforced. Ordinary accounts can browse, contact sellers about buying, follow sellers, recommend sellers and like items under their existing rules. Bidding still requires ID approval and rejects own-item bids or unavailable auctions. There is no automatic checkout/payment flow.

Activate the database restriction by running `supabase/migrations/202610100015_admin_only_selling.sql` as a **new query** in Supabase SQL Editor after the installed migrations. The website checks trusted `is_marketplace_admin` membership, but this SQL step is required to block direct listing writes. It changes public marketplace objects only and does not need ownership of Supabase’s managed Storage table. It replaces the previous seller verification guards with admin guards and preserves existing listings, photos, bids, public reads and private account data. No new keys or Hostinger environment variables are needed. The connected service-role data key cannot execute schema SQL. After activation, the public `marketplace_selling_policy` RPC returns `admin-only`, confirming listing restrictions only. Additional direct photo-storage write protection is separate: `supabase/migrations/202610100016_admin_only_listing_photo_writes.sql` requires authorized Storage policy-management access. If SQL Editor reports `postgres`, owner `supabase_storage_admin` and owner-role access `false`, run only migration 015 and ask Supabase support to resolve Storage policy permissions before applying 016. Existing Storage permissions remain unchanged until 016 succeeds; website upload helpers already require admin membership. Do not change managed-table ownership or grant yourself managed roles.

Validation: 124 automated tests, a production build and browser checks for the website update, plus 47 local database checks for the split migrations. Coverage includes verified non-admin write rejection, buyer bidding, unverified admin listing/photo writes, moderation, role revocation, role-check failures, mobile layouts and administrator Facebook posting. Browser writes were mocked. Hosted SQL activation and Hostinger deployment must be confirmed separately.

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

Public homepage listings, Browse results and auction cards are rendered on the server. Marketplace lists include public active/sold undeleted items, while item SEO previews and the sitemap remain active-only. Reads use the Supabase anonymous key and never bypass database access rules. Browse queries the real marketplace instead of sample products.

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

## Marketplace ordering

Home, Browse, Auctions and seller listings show live auctions in closing-time order, then available fixed-price stock, upcoming auctions, and finally sold, ended or out-of-stock items. Available fixed-price and closed items use newest-first ordering within their groups. Only the latest auction for an item is considered. Expiry is determined from the closing timestamp as well as the saved status; a timer reaching zero never marks an item as sold or changes bid records.

Ordering happens before selecting each 24-item page. The public `/api/marketplace/listings` endpoint reads a lightweight anonymous index in 1,000-row pages, then retrieves photos/descriptions for the selected IDs only. It preserves category/search/seller filters and excludes hidden/deleted items. Index reads stop with an explicit error if 10,000 rows or inconsistent repeated IDs are encountered; move ordering into a paginated database function before the marketplace reaches that scale. Nothing is silently truncated. This feature requires no SQL migration or new secrets.

Mounted grids reorder when an auction expires. Home, Auctions and seller listings also refresh every 30 seconds to update page membership and availability; Browse refreshes its server page when a visible auction changes state. Closed cards are labeled, and sold-item links show a sold notice with stock-selection controls disabled. Existing bidding authorization still prevents bidding on closed or sold items.

Validation: 118 automated tests and a production build, plus browser checks with local REST fixtures for global pagination, expiry ordering, sold-item navigation, privacy guards, photos, hearts and mobile widths. Hosted Supabase checks were read-only.

## Item hearts and likes

Listings on Home, Browse, seller profiles and Live Auctions, plus individual item pages, have heart buttons and actual like counts. Sign in to like/unlike an item; ID approval is not required for likes. Each account can like an item once. Guests can see counts and receive a sign-in link when tapping a heart. Hearts change only after a confirmed database save, and repeated clicks cannot start overlapping mutations. Duplicate cards for the same item share the updated count. Offline actions are disabled; unknown outcomes show a refresh action without automatically repeating a write or inventing a zero count.

Activate by running `supabase/migrations/202610100014_listing_likes.sql` as a **new query** in Supabase SQL Editor after the existing migrations, then deploy/refresh the website. This additive migration creates a private likes table and two narrowly scoped functions. It preserves listings, bids, followers and Facebook posts and needs no new keys. The current connected data API cannot execute schema migrations; this SQL Editor step remains necessary. Public aggregate reads expose only item ID, count and the caller's own liked state, never liker identities. Mutations use `auth.uid()`, cannot change another account's likes, are idempotent and exclude hidden/deleted listings. The table has RLS and no browser table access. Visible cards batch reads up to 100 items, and changing accounts replaces the client state and discards old responses. Website likes are separate from Facebook reactions and seller recommendations.

Validation: 107 automated tests, 36 local PostgreSQL-compatible checks and a production build. Mocked Chromium checks cover duplicate instances, like/unlike, repeated clicks, saved state after reload, auction and item-page controls, guest sign-in, offline blocking, failed writes, missing setup, link/button separation and mobile/desktop layouts. No hosted likes or Facebook writes were created by testing. A hosted signed-in smoke test follows SQL installation and Hostinger deployment.

## Listing photos and Facebook sharing

Auction cards on Home and Auctions use the listing's public cover photo, with an icon when no photo is attached. Item pages use an original PinoyBuyNSell layout with a large photo, thumbnail navigation, enlarged photo dialog, pricing/bidding, stock options, shipping, description and item details. Desktop places photos beside the details; phones stack them. No seller ratings, views, favorites or purchase protections are invented.

New and edited listings accept up to eight optional JPEG, PNG, WebP, HEIC or HEIF photos, up to 5 MB each. Sellers can append/remove photos and select the cover. Uploads inspect the actual file bytes rather than trusting the filename. HEIC/HEIF photos convert locally in a browser worker to JPEG before preview or upload, including HEIC files incorrectly named `.jpg`. The decoder loads only when needed. Converted images over 5 MB are resized and compressed to fit; unreadable files stop before any upload. The storage bucket continues to receive browser-compatible JPEG, PNG or WebP files.

To enable saving multiple photos, run `supabase/migrations/202610090012_listing_gallery.sql` once as a new Supabase SQL Editor query after prior migrations. It adds `products.image_paths` with a maximum of eight unique, seller-owned paths and enforces the first path as the existing `image_path` cover. Existing single-photo listings remain unchanged. Server reads fall back to the existing columns while this migration is pending, and single-photo saves still work. A multiple-photo save fails before uploading if the column is missing. Editing preserves existing photos unless removed; removed objects are retained because external posts or other references can still use them. Explicit failed saves clean up only newly uploaded objects; uncertain network outcomes retain them to protect a potentially successful save.

On October 9, 2026, listing 5's mislabeled HEIF photo was converted to a metadata-free JPEG in a new public storage object and only that listing's `image_path` was updated. Its original photo and auction terms were preserved.

Administrator-owned active listings offer **Post to PinoyBuyNSell Page**, which opens `/admin/facebook?listing=ID` for review and an explicit **Post to Facebook** click. This uses the existing server-side Page publisher instead of Facebook's general sharing composer. Opening the screen never posts automatically. General profile/group sharing and **Copy listing link** remain available; clipboard-denied browsers get a selectable link. Public visitors and other sellers do not get the Page-publishing action. Server authorization and ownership checks remain mandatory even if someone opens the URL directly.

The posting screen loads just the selected listing, shows published/failed/uncertain outcomes and links to confirmed Facebook posts. Status reads and session checks have deadlines, and posting responses are bounded through JSON parsing. Database operations in the server publisher have deadlines; expired-token, permission, image, publishing restriction and rate-limit errors give specific guidance without showing provider secrets. Unknown outcomes never retry automatically. Check the Page before posting: manual Facebook shares are not recorded by this publisher. The existing Hostinger Page credentials and SQL setup are reused; no new environment variables or migration are required.

For an outdated preview, enter the product URL in https://developers.facebook.com/tools/debug/ and choose **Scrape Again**. The website cannot confirm or cancel posts made through Facebook's external share composer. The direct Page publishing flow avoids that composer for eligible administrators; actual Meta publishing still depends on valid Page permissions and hosting credentials.

Meta publishing error 368 means the specific request was blocked; it does not establish that the Page has a visible account restriction. The publishing manager now gives guidance for clear Page-status screens and links to Account Status and the Sharing Debugger with the exact listing URL. Older saved 368 messages are corrected for display without changing records or submitting another post. New 368 rejections preserve a numeric diagnostic subcode when Meta provides one, without exposing raw provider text or credentials. Existing publish/update outcomes and duplicate-post guards remain intact. The actual Meta block is unresolved until its URL/app/posting diagnosis is completed; changing this guidance does not clear a Facebook block. No SQL or new credentials are needed for the guidance update. Validation: 133 tests, production build, and mocked browser checks for saved-error conversion, caption-update outcomes, diagnostic links, no automatic posting, admin visibility and mobile/desktop layouts. Hosted photo checks were read-only.

Saving edits to an administrator's own listing automatically updates the caption of its tracked, published Facebook Page post. The caption uses the saved title, description excerpt, price or auction starting bid/closing time, stock, variations, condition, location and shipping. It updates the same post ID, retaining comments and reactions. New listings still require an explicit Post to Facebook click. Manually shared posts are untracked, and changed photos/link-preview attachments need a separate Facebook edit. Deleting a website listing does not remove the Page post.

The editor confirms the website save separately from Facebook success or failure. **Update Facebook details** on the posting screen retries a caption update without creating a new post. The sync endpoint verifies administrator ownership, uses only the trusted saved Page/post IDs, conditionally reserves the existing posting record, rereads the latest listing and coalesces overlapping edits. Original published status and post ID survive a rejected or uncertain update. Stale caption-update locks become retryable after two minutes because updating the same post is idempotent; uncertain initial publication remains blocked. Existing migration 010 and Hostinger credentials are reused: no new SQL or environment variables are needed. There is no background sync for database edits or recurring retry worker.

Validation for caption syncing: 96 automated tests and a production build; mocked browser checks cover save-before-sync, double-click protection, retained gallery uploads, separate website success after Meta failure, retries without republishing/resaving, non-admin and untracked listings, manual first publication, and mobile/desktop layouts. Authorization, compare-and-set concurrency, overlapping saves, safe Meta errors and bounded unknown outcomes are tested without sending real Facebook updates. Confirm the hosted integration after deployment by editing a website-published test listing and checking the same Page post.

Validation for the October 9 gallery update: 64 automated tests, 50 local database checks, zero reported npm vulnerabilities, a production build, real HEIF conversion in Chromium, multi-photo mock create/edit flows, gallery keyboard/focus checks and mobile/desktop layouts. Browser writes and bids are mocked; no real Facebook post is sent. Read-only hosted checks confirmed the gallery column and validator are available; a signed-in seller smoke test and Hostinger deployment still need confirmation.

Validation for the October 10 sharing fix: 77 automated tests and a production build, plus browser checks for administrator ownership, selected-listing review without automatic posting, exactly one mock publish for duplicate clicks, saved-result displays, stale-processing protection, bounded status loading, invalid links and mobile/desktop layouts. Listing 5's public cover was verified as a real JPEG; its posting records were read without changing them. Live Hostinger HTML is inaccessible from this cloud network, and the hosting Page credentials are not injected here. A real Page post is therefore a user smoke test after Hostinger deploys; local browser publishing requests are intercepted and never sent to Meta.

## Administrator task notices

My Account → Administrator tools shows exact counts for pending ID reviews, open support conversations, and USA shopping requests in `new` or `contacted` status. Each count links to its queue. A combined attention badge appears on the desktop My Account link and the mobile Account tab; large totals display as `99+`. These are outstanding work counts: a replied-to support conversation still counts until closed, and a contacted USA request still counts until closed. The total covers these three queues, not Facebook posting errors or listing moderation.

Counts refresh every 30 seconds while the website tab is visible, on focus/reconnection, through Refresh task counts, and immediately after a successful ID decision, support closure, or USA request status change. This feature needs no new SQL migration, Hostinger secret, or outbound notification service. It uses count-only HEAD requests through the signed-in Supabase client and existing RLS; no customer contact details or private ID documents are retrieved for badges. Trusted administrator membership is checked before each count refresh. Ordinary accounts do not query these queues for notices, and revoked access removes the tools and badges.

Unavailable counts are identified explicitly, with a partial total when other queues load. An all-clear message appears only after all three counts load successfully as zero. Requests have an eight-second deadline; offline state, account changes and overlapping refreshes discard outdated results. Counts are foreground website notices and do not send email or push notifications.

Validation: 130 automated tests and the production build passed. Mocked Chromium checks cover admin/member visibility, counts above 1,000, partial errors and recovery, badge overflow, updates after each queue action, all-clear state, offline recovery, automatic polling, role revocation, and 320/390/1280 layouts. Hosted checks were read-only and confirmed the three exact-count queries and browser access to their count headers. No real customer records were updated during testing.

## Next development stages

- Database and real product listings
- User authentication
- Seller profiles
- Image uploads
- Search/filtering
- Buyer/seller messaging
- Real bidding and payments
- Admin dashboard
