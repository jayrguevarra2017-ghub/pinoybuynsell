import USAShoppingPage from "@/components/USAShoppingPage";
import { readPublicUSAItems } from "@/lib/public-usa-items.mjs";

export const dynamic = "force-dynamic";

export default async function Page() {
  let items = null;
  try { items = await readPublicUSAItems({ env: process.env }); }
  catch { /* The browser can retry; the shopping guide and quote form remain available. */ }
  return <USAShoppingPage initialItems={items}/>;
}
