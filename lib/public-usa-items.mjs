import { usaItemId, usaStoreLink } from "./usa-items.mjs";

export const publicUSAItemFields = "id,title,item_url,store,description,image_path,usd_price,status,created_at";

export async function readPublicUSAItems({ env, fetchImpl = fetch }) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw Error("USA items unavailable");
  const params = new URLSearchParams({ select: publicUSAItemFields, status: "eq.published", order: "created_at.desc", limit: "100" });
  const response = await fetchImpl(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/rest/v1/usa_shopping_items?${params}`, {
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
    cache: "no-store", signal: AbortSignal.timeout(8000), redirect: "error",
  });
  if (!response.ok) throw Error("USA items unavailable");
  const rows = await response.json();
  if (!Array.isArray(rows)) throw Error("USA items unavailable");
  return rows.filter(row => row && row.status === "published" && usaItemId(row.id) &&
      typeof row.title === "string" && typeof row.description === "string" &&
      usaStoreLink(row.item_url)?.name === row.store &&
      typeof row.image_path === "string" && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(row.image_path))
    .slice(0, 100).map(row => Object.fromEntries(publicUSAItemFields.split(",").map(key => [key, row[key]])));
}
