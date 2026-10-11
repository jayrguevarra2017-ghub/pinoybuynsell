import { createClient } from "@supabase/supabase-js";
import { handlePaymentReceipt } from "@/lib/payment-receipts.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handle = request => handlePaymentReceipt(request, { env: process.env, createClient });
export const GET = handle;
export const POST = handle;
