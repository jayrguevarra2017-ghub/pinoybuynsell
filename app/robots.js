import { siteUrl } from "@/lib/seo.mjs";

export default function robots() {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/login", "/reset-password", "/verify", "/sell", "/api/"] },
    sitemap: `${siteUrl}/sitemap.xml` };
}
