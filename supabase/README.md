# Enable marketplace bidding

Run `migrations/202610080001_place_bid.sql` once in the Supabase project's SQL Editor, using an administrator session. The script runs in a transaction and assumes the existing public products and auctions columns used by the app. If it fails, the transaction rolls back; share the error without credentials rather than disabling checks.

The migration adds marketplace_bids and the authenticated place_marketplace_bid RPC. It records bids and updates the auction price atomically under a row lock. It rejects anonymous users, sellers bidding on their own products, unavailable listings, auctions outside their date range, invalid money amounts, and amounts that do not exceed both the current and starting prices. Minimum increase is PHP 0.01. It removes client insert/update/delete privileges on auctions; future auction management should use separately validated server functions. Do not restore direct client price-update privileges.

The application uses the existing Supabase public anon key and the signed-in user's session. Never put a service-role key in NEXT_PUBLIC variables. This migration does not need to change either deployed environment variable.

After installation and Hostinger deployment, sign in as a buyer other than the listing seller and use an active test auction. Confirm one successful bid updates its price and creates a marketplace_bids row. Verify a seller cannot bid, lower/equal bids fail, and expired auctions reject bids. Actual bid submission writes persistent records; use a designated test auction. Local PostgreSQL-compatible checks covered valid/rejected bid paths and direct-write protection. The production Supabase migration and real signed-in bidding have not been executed by Codex.

## Listing shipping

Run `migrations/202610080002_listing_shipping.sql` once in SQL Editor before using the new seller form. It adds shipping_carrier and shipping_fee, requires both on every new listing, and validates carrier choices and nonnegative fees with at most two decimal places. A fee of zero means free shipping. Existing listings remain unchanged with unknown shipping details; enter accurate fees through the products table editor when appropriate. Do not infer or backfill fees as zero. The product page and homepage cards show shipping separately from price or bids. The browse page still uses repository sample listings and will show unknown shipping for those samples.

Local checks validated the migration, rejection of missing/invalid fields, free and paid shipping, legacy listing preservation, and display formatting. Applying the migration and saving a real seller listing in the hosted Supabase project remain manual deployment checks.

## Listing photos

Run `migrations/202610080003_listing_photos.sql` once as a new query in Supabase SQL Editor. This adds products.image_path and creates the public listing-photos bucket with a 5 MB limit and JPEG/PNG/WebP MIME restrictions. Authenticated users can upload and remove objects only beneath their own user ID folder. Product photo paths must belong to the listing seller. Existing storage policies, if any, should be reviewed for broader access to this bucket.

The Sell an Item form reached from My Account supports one optional photo with a preview. The image is uploaded before listing insertion; an explicitly rejected insertion triggers cleanup. Network failures with unknown save outcomes retain the image to avoid deleting a successful listing's photo. Public listing photos can be viewed without sign-in. Existing listings remain unchanged, and attaching photos to existing listings is not yet supported by an account editing screen.

Production build, mocked upload/save failure checks, and local PostgreSQL-compatible migration and cross-user ownership checks passed. Real hosted Storage upload and photo display require the migration and a signed-in seller smoke test after Hostinger deployment.

## Seller listing edits

Run `migrations/202610080004_seller_listing_edits.sql` once as a new Supabase SQL query after the shipping and photo migrations. My Account now lists the signed-in seller's items with View and Edit links. Editing reuses the seller form and saves title, description, price, category, condition, location, shipping carrier/fee, and an optional replacement photo. Existing status and auction/bid records are preserved. Old listings must receive shipping details before saving.

The migration enables product RLS, adds owner-only SELECT and UPDATE policies, and adds a restrictive UPDATE guard that also applies when a legacy permissive policy is broad. Ownership transfers are rejected by a trigger. Existing policies restricting visibility may still require project-specific review. It does not grant anonymous editing. Replaced photos are retained to avoid deleting photos referenced elsewhere; storage cleanup can be handled separately.

The production build and local owner/cross-user/ownership-transfer tests passed, including a broad legacy UPDATE policy. Mock checks covered photo retention, replacement, rejected saves and uncertain network outcomes. Real signed-in hosted edits remain a deployment smoke test: edit your own item, confirm public details update, and ensure a second account cannot edit it.

## Private ID verification and administrator approval

Run `migrations/202610080005_identity_verification.sql` once in a new Supabase SQL Editor query after migrations 001–004. It creates a private identity-documents bucket, owner-readable verification status records, trusted admin membership, and admin-only review functions. Existing and new users must submit a government ID and receive approval before listing, editing or bidding. Public browsing remains available. There is no checkout/order flow in this repository; future purchases must enforce is_marketplace_verified on the server too.

Signup first creates a pending authentication account. After email confirmation, the user signs in and uploads an ID at /verify. This permits authenticated private uploads rather than anonymous ID collection. ID submission accepts one JPEG/PNG/WebP image up to 5 MB, a full name and ID type; status becomes pending. Rejected users can resubmit. Approved/pending submissions cannot be replaced through the user RPC. Approval is a manual document review, not automated identity authentication or a guarantee of safety.

Choose the administrator explicitly. Create their normal account, then in Supabase Authentication → Users copy its User UID. As database administrator run a separate query, replacing the placeholder:

```sql
insert into public.marketplace_admins(user_id)
values ('REPLACE_WITH_ADMIN_USER_UUID') on conflict do nothing;
```

Never store admin authority in user-editable signup metadata. The designated admin signs in and opens /admin/verifications (linked from My Account). Only trusted admin membership permits viewing private IDs with 60-second signed URLs or approving/rejecting users. Admins cannot review their own submissions; another designated admin is needed if they also want to sell/bid. Keep the private bucket private, audit existing Storage policies for broad access, and restrict admin membership. Do not use the public listing-photos bucket for IDs.

Document retention is manual: review and remove obsolete ID uploads through the administrator Storage dashboard according to the site's stated retention policy. Resubmissions and failed submissions can leave orphaned private documents; no scheduled deletion is configured. Do not copy private document values into logs or analytics. The migration does not migrate or publish any live ID data.

Production build and local database checks passed for private ID reads, unapproved listing and bid rejection, admin-only approval, rejection of direct status/admin writes and successful approved actions. Hosted ID upload, signed URL access, email-confirmation flow and admin approval need real staging verification after applying the migration. Existing accounts are not automatically approved. Keep the previous migrations; do not rerun them.

## USA shopping assistance

Run `migrations/202610080006_usa_shopping_requests.sql` once as a new query in Supabase SQL Editor. The homepage and /usa-shopping introduce the service and collect contact name/email/phone, city/province, item name, HTTPS item link, quantity and item specifications. Sign-in is required to submit; inquiries are quote requests rather than purchase/payment transactions. Pending users may inquire; staff must verify account approval before proceeding with any purchase. No automatic checkout or order creation is implemented.

Requests are saved privately in usa_shopping_requests, visible to the requesting user and designated marketplace administrators. Admins review the latest 100 requests at /admin/usa-requests, linked from My Account, and mark them new/contacted/closed. Follow up using the supplied contact information. There are no automatic email notifications or email delivery integration. Links are not fetched automatically; open external links carefully and confirm availability directly. Fees and timelines are agreed individually, with no hardcoded quote promises.

The database function limits each user to five requests per rolling 24 hours and uses a per-user transaction lock to protect the count. Local tests covered anonymous rejection, contact/link/quantity validation, private read permissions, admin-only status updates and the daily limit. Build passed. Applying the migration and sending a real signed-in request after Hostinger deployment remain hosted smoke tests.

## Administrator listing deletion

Run `migrations/202610080007_admin_listing_deletion.sql` once as a new Supabase SQL query after earlier migrations. Admins open /admin/listings from My Account, choose a listing, enter a reason and confirm deletion. This is a soft deletion: it adds deleted_at and retains product records, photos, auctions and bids. Deleted listings are hidden from public readers and cannot receive further bids. Admins can still see archived records; no restore UI or physical file deletion is included.

The database function enforces trusted administrator membership, locks auctions before the product to match bid lock order, marks the listing removed and records who removed it and why in an admin-only audit table. Direct user deletion-marker edits are rejected even with a broad existing update grant. Restrictive policies prevent public reads and seller updates of deleted records. The bid function explicitly rejects removed listings. Homepage queries exclude deleted items and related auctions even for admins.

Build and local database tests passed for non-admin rejection, direct marker protection, required reason, audit creation, repeat deletion rejection, public hiding and blocked bids. No real listing was deleted during implementation. Run the hosted smoke test on an explicitly designated test listing after migration and deployment; confirmation is required in the UI.

## Support chat popup

Run `migrations/202610080008_support_chat.sql` once as a new Supabase SQL query. A floating support launcher appears through the root layout across the site. Signed-in users can start a private conversation and send messages; the latest conversation is restored on reopening. Replies are checked every ten seconds while the popup is open. Closed conversations allow starting a new one. Admins use /admin/support (linked from My Account) to read, refresh, reply and close conversations. Admins refresh manually; no push or email notifications are configured.

This is asynchronous human support, not an automated bot or guaranteed live agent. No online presence or response-time guarantee is shown. Sign-in is required to keep threads private. Each user can start five conversations per day and send twenty messages per hour; the database validates body length and determines sender roles, rather than trusting client fields. Private thread reads are restricted to their owner and designated admins. Unverified users can contact support to resolve account issues.

Local database checks passed for unauthenticated rejection, cross-user isolation, admin replies, closure and message limits. Production build passed. Hosted customer-to-admin-to-customer messaging remains a smoke test after applying the migration and deploying. Do not submit passwords, payment card details or identity documents through chat.

## Automated website support guide

The support popup now opens with a guided bot available before sign-in. It provides preset topics and keyword-matched answers for new users, registration, verification, selling/editing, bidding, USA shopping, shipping and buying/payment limitations. Answers and navigation links are maintained in lib/support-guide.js. It does not use an external AI service or access personal account records. Questions stay in component memory and clear when the guide is closed or unmounted. Message the support team switches to the existing authenticated inbox and prefills the last question; users must explicitly send it. Human messages use migration 008; the guide itself needs no additional migration or credentials.

Production build and example-question routing checks passed, including unknown-question fallback, safe local links and word boundary matching. Keep the guide answers updated when marketplace workflows change. It cannot approve IDs, place bids, take payments, or confirm account-specific outcomes.

## Prohibited-items policy

Run `migrations/202610080009_listing_policy.sql` once as a new query before publishing or editing through the updated seller form. The /prohibited-items page lists items the marketplace does not accept, and the policy is linked from the homepage footer and USA shopping form. Sellers must actively acknowledge the current policy when using the form; products store listing_policy_version. The database requires the current policy version on new listings and substantive listing edits, even if client validation is bypassed. Existing listings remain readable, and admin deletion is not blocked.

Acknowledgment does not verify the item's content or automatically flag prohibited goods. Administrators still review reports through support and remove violations through listing management. There is no keyword-based automatic rejection, legal certification, or retroactive content audit. Policy details are maintained in lib/listing-policy.js; a future version change requires matching migration/form updates.

Production build and local migration checks passed for missing/outdated acknowledgment rejection, accepted inserts and edits, legacy readability, and moderation updates. Hosted seller saves require migration installation and a manual smoke test after deployment.

## Administrator-owned listings on Facebook

Run `migrations/202610080010_facebook_listing_posts.sql` once as a **new query** in Supabase SQL Editor after earlier migrations. This adds private posting records and service-only reservation/completion functions. It does not post existing listings or enable automatic posting. Only designated marketplace administrators can use /admin/facebook (linked from My Account), and only for their own active, undeleted listings. Regular sellers cannot post through this integration, and administrators cannot post other sellers' items. Authorization and ownership are enforced in the server endpoint and rechecked in the database reservation function.

In Hostinger, preserve the existing public Supabase variables and add server variables `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_GRAPH_API_VERSION` (currently `v26.0`), and `SUPABASE_SERVICE_ROLE_KEY`. Obtain the service-role key privately from Supabase Project Settings → API Keys → Legacy anon, service_role API keys. All four are server settings; never prefix secrets with NEXT_PUBLIC, commit values or send them through chat. The service-role key is used only for posting records and claims after caller authentication and administrator/ownership checks. It must not be passed to a browser. Hostinger settings do not transfer credentials to the Codex cloud machine.

The Page token must be a valid Page token for the configured Page with pages_manage_posts and pages_read_engagement. pages_show_list is needed when obtaining Page access. A token marked Expires: Never can still be revoked; monitor data-access expiry and reauthorize as Meta requires. Development/standard access is limited to app-role users and authorized assets; follow Meta's current review and publishing requirements for broader access. This integration uses the Page feed/photos API, not Facebook Marketplace or ads. Ordinary publishing does not purchase advertising.

An administrator clicks Post to Facebook to make a public post. Listing title, description excerpt, price, condition, location, carrier and shipping fee are included, along with the website link. Listings with a photo publish it through the public listing-photos bucket; listings without a photo use a link post. Auction details are available on the linked product page; the caption price is the listing price, not an auction bid. One saved post per listing prevents duplicate clicks and simultaneous requests. Explicit Meta rejection allows a retry after one minute. Timeouts, interrupted requests, or uncertain results block another attempt until checked, because Meta might have published before the response was lost. There is no background publisher or recurring automatic retry.

Editing or deleting a website listing does not edit/remove the Facebook post. Manage existing posts directly on the Facebook Page. Changing the configured Page does not repost listings already marked published. No real Facebook post is sent during local testing.

To resolve an uncertain/interrupted posting record, first inspect the Facebook Page for the listing. If a post exists, the database owner may record its actual numeric post ID (or PageID_PostID) and set status='published'. If definitely absent, the database owner may set status='failed' and updated_at=clock_timestamp()-interval '2 minutes' for that exact listing_id, then retry in the admin page. Preserve all other records. This is a manual recovery procedure; never reset status merely because the website request timed out.

Verification: `node --test tests/facebook-publishing.test.mjs` checks authorization, ownership filters, missing configuration, caption/photo requests, duplicate/processing guards, secret redaction and uncertain outcomes using mocked Meta requests. Hosted activation still requires the SQL migration, server credentials, a successful Hostinger build, and an explicit Post to Facebook click on an administrator-owned test listing. Confirm one visible Page post, then refresh and verify that the listing is marked published and cannot create a duplicate.

## Item previews when sharing listing links

Product routes now generate server-rendered Open Graph and Twitter metadata with the active item's title, price, short description, canonical URL and attached public listing photo. Facebook can read these tags without executing the client-side product/bidding interface. Metadata queries use only the public Supabase key, explicitly filter active undeleted products, and respect RLS; they never use the service-role key. Unavailable/private listings return generic no-index metadata without their details or photos. Listings without an attached photo produce text previews. No new SQL migration or credentials are required for this change.

After deploying, enter the exact product URL in Meta's Sharing Debugger at https://developers.facebook.com/tools/debug/ and click Debug, then Scrape Again to refresh Facebook's cached link data. Future shares should use the item preview; Facebook controls whether an existing post's attachment updates. Website changes do not automatically edit published captions/photos. Uploaded listing images must be publicly reachable in the listing-photos bucket. Item photo publishing through the admin API remains separate from link preview metadata.

`node --test tests/product-metadata.test.mjs` checks public-only queries, item title/image/price metadata, removed/inactive listings, failed reads and safe image paths. Verify actual production HTML tags and use Sharing Debugger after Hostinger deployment to confirm what Facebook fetches.
