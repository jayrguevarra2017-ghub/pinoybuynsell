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
