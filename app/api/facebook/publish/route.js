import { createClient } from "@supabase/supabase-js";
import { handleFacebookPublish } from "@/lib/facebook-publishing.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  return handleFacebookPublish(request, { env: process.env, createClient });
}
