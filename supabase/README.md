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
