import { createClient } from "@supabase/supabase-js";
import { handleListingSuggestions } from "@/lib/listing-suggestions.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request) {
  return handleListingSuggestions(request, { env: process.env, createClient });
}
