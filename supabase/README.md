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
