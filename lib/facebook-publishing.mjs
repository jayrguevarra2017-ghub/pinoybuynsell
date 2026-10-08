const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export function facebookCaption(product) {
  const money = value => Number(value).toLocaleString("en-PH", { style: "currency", currency: "PHP" });
  const link = `https://pinoybuynsell.com/product/${encodeURIComponent(String(product.id))}`;
  return [String(product.title || "Marketplace listing").slice(0, 200), `Price: ${money(product.price)}`,
    product.condition && `Condition: ${product.condition}`, product.location && `Location: ${product.location}`,
    product.shipping_carrier && product.shipping_fee != null && `Shipping: ${product.shipping_carrier} · ${money(product.shipping_fee)}`,
    String(product.description || "").slice(0, 1500), `View item details and auction information: ${link}`].filter(Boolean).join("\n\n");
}

// Dependencies are injected for verification without publishing to a real Page.
export async function handleFacebookPublish(request, { env, createClient, fetchImpl = fetch }) {
  try {
    const authorization = request.headers.get("authorization") || "";
    if (!/^Bearer \S+$/i.test(authorization)) return json({ message: "Sign in to post a listing." }, 401);
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const publicKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !publicKey) return json({ message: "The website database connection is not configured." }, 503);
    const client = createClient(url, publicKey, { ...clientOptions, global: { headers: { Authorization: authorization } } });
    const auth = await client.auth.getUser(authorization.slice(7));
    if (auth.error || !auth.data?.user) return json({ message: "Sign in again before posting." }, 401);
    const admin = await client.rpc("is_marketplace_admin");
    if (admin.error || admin.data !== true) return json({ message: "Administrator access required." }, 403);
    let body;
    try { body = await request.json(); } catch { return json({ message: "Invalid listing request." }, 400); }
    if (typeof body?.listingId !== "string" || !/^[A-Za-z0-9-]{1,100}$/.test(body.listingId)) return json({ message: "Invalid listing ID." }, 400);
    const item = await client.from("products").select("*").eq("id", body.listingId).eq("seller_id", auth.data.user.id).maybeSingle();
    if (item.error) return json({ message: "Could not check this listing. Try again later." }, 503);
    if (!item.data || item.data.seller_id !== auth.data.user.id || item.data.deleted_at || item.data.status !== "active") return json({ message: "Only your own active listings can be posted to Facebook." }, 403);
    const pageId = env.FACEBOOK_PAGE_ID;
    const pageToken = env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const version = env.FACEBOOK_GRAPH_API_VERSION || "v26.0";
    if (!/^\d+$/.test(pageId || "") || !pageToken || !/^v\d+\.\d+$/.test(version) || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json({ message: "Configure the Facebook Page credentials and SUPABASE_SERVICE_ROLE_KEY in Hostinger before posting." }, 503);
    }
    const server = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, clientOptions);
    const claimed = await server.rpc("claim_facebook_listing_post", { p_listing_id: body.listingId, p_user_id: auth.data.user.id, p_page_id: pageId });
    if (claimed.error || !claimed.data) return json({ message: "Could not reserve this post. Install the Facebook publishing migration and refresh before retrying." }, 503);
    const job = claimed.data;
    if (job.status === "published") return json({ status: "published", postId: job.post_id, message: "This listing is already posted to Facebook." });
    if (!job.claim_token) return json({ status: job.status, message: job.status === "uncertain"
      ? "Check the Facebook Page before retrying: the previous post may have succeeded."
      : "This listing is being posted, or is waiting before a retry. Refresh its status shortly." }, 409);
    const product = job.product;
    const link = `https://pinoybuynsell.com/product/${encodeURIComponent(String(product.id))}`;
    const parameters = new URLSearchParams();
    let endpoint = "feed";
    if (product.image_path) {
      // Build only a URL in the existing public listing-photo bucket, never an arbitrary client URL.
      const photo = server.storage.from("listing-photos").getPublicUrl(product.image_path);
      parameters.set("url", photo.data.publicUrl);
      parameters.set("caption", facebookCaption(product));
      endpoint = "photos";
    } else {
      parameters.set("message", facebookCaption(product));
      parameters.set("link", link);
    }
    let status = "uncertain", postId = null, message = "Facebook did not confirm the result. Check the Page before retrying; the post may exist.";
    try {
      const response = await fetchImpl(`https://graph.facebook.com/${version}/${pageId}/${endpoint}`, {
        method: "POST", headers: { Authorization: `Bearer ${pageToken}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: parameters.toString(), signal: AbortSignal.timeout(20000), redirect: "error", cache: "no-store",
      });
      const result = await response.json();
      if (response.ok && /^\d+(?:_\d+)?$/.test(String(result.post_id || result.id || ""))) {
        status = "published"; postId = String(result.post_id || result.id); message = "Listing posted to Facebook.";
      } else if (response.status < 500 && result.error) {
        status = "failed";
        message = result.error.code === 190 ? "Facebook authorization expired or was revoked. Replace the Page token in Hostinger."
          : "Facebook rejected this post. Check Page publishing permissions, the listing photo, and Meta app access before retrying.";
      }
    } catch { /* A timeout can occur after Meta accepts a post. Never retry it automatically. */ }
    const saved = await server.rpc("finish_facebook_listing_post", { p_listing_id: body.listingId, p_claim_token: job.claim_token,
      p_status: status, p_post_id: postId, p_message: message });
    if (saved.error || saved.data !== true) return json({ status: "uncertain", message: "Could not save the posting result. Check Facebook before retrying; the post may already exist." }, 503);
    return json({ status, postId, message }, status === "published" ? 200 : status === "failed" ? 422 : 409);
  } catch {
    // Do not expose provider responses, credentials, or authentication internals.
    return json({ message: "Could not confirm the request. Refresh the posting status and check Facebook before retrying." }, 503);
  }
}
