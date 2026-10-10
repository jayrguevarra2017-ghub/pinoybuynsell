import { createClient } from "@supabase/supabase-js";
import { handleSellerBidNotices } from "@/lib/seller-bid-notices.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handle = request => handleSellerBidNotices(request, { env: process.env, createClient });
export const GET = handle;
export const POST = handle;
