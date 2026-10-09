import { createClient } from "@supabase/supabase-js";
import { handleFacebookSync } from "@/lib/facebook-sync.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request) {
  return handleFacebookSync(request,{env:process.env,createClient});
}
