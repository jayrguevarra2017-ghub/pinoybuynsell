import { createClient } from "@supabase/supabase-js";
import { handleUSAItemPublish } from "@/lib/usa-facebook-publishing.mjs";

export async function POST(request) {
  return handleUSAItemPublish(request, { env: process.env, createClient });
}
