import { usaItemFields, usaItemId, usaStoreLink } from "./usa-items.mjs";
import { publicUSAItemFields } from "./public-usa-items.mjs";
import { usaFacebookJobId, usaItemCaption } from "./usa-item-sharing.mjs";
import { facebookRejectionMessage } from "./facebook-publishing.mjs";
import { withFacebookDeadline } from "./facebook-posting.mjs";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const jobFields = "listing_id,owner_id,page_id,status,claim_token,post_id,message,attempts,updated_at";
const uncertainMessage = "Check the Facebook Page before another attempt; the post may already exist.";

function publishable(item, id, userId) {
  return item?.id === id && item.admin_id === userId && item.status === "published"
    && typeof item.title === "string" && typeof item.description === "string"
    && usaStoreLink(item.item_url)?.name === item.store
    && typeof item.image_path === "string" && item.image_path.startsWith(`${userId}/`)
    && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(item.image_path);
}

// Unique namespaced keys and conditional writes reuse migration 010's private
// ledger. Products use numeric keys and can never collide with "usa:<uuid>".
// Only the server's service role may write this table; browsers remain read-only.
export async function claimUSAItemPost(server, { itemId, userId, pageId, deadline = 8000, now = Date.now(), newToken = () => crypto.randomUUID() }) {
  const key = usaFacebookJobId(itemId), timestamp = new Date(now).toISOString();
  if (!key) throw Error("Invalid USA item.");
  const token = newToken();
  const inserted = await withFacebookDeadline(server.from("facebook_listing_posts").insert({
    listing_id: key, owner_id: userId, page_id: pageId, status: "processing", claim_token: token, updated_at: timestamp,
  }).select(jobFields).maybeSingle(), deadline);
  if (!inserted.error && inserted.data?.claim_token === token) return { claimed: true, job: inserted.data };
  // A transport failure could have saved the insert. Only a confirmed unique
  // conflict permits reading/reclaiming a previous definite failure.
  if (inserted.error?.code !== "23505") throw Error("Could not reserve the post.");
  const existing = await withFacebookDeadline(server.from("facebook_listing_posts").select(jobFields)
    .eq("listing_id", key).eq("owner_id", userId).maybeSingle(), deadline);
  if (existing.error || !existing.data) throw Error("Could not read posting status.");
  const job = existing.data, age = now - Date.parse(job.updated_at);
  if (job.status === "processing" && age > 120000) {
    const saved = await withFacebookDeadline(server.from("facebook_listing_posts")
      .update({ status: "uncertain", message: uncertainMessage, updated_at: timestamp })
      .eq("listing_id", key).eq("owner_id", userId).eq("claim_token", job.claim_token)
      .eq("status", "processing").eq("updated_at", job.updated_at).select(jobFields).maybeSingle(), deadline);
    if (saved.error || !saved.data) throw Error("Refresh posting status.");
    return { claimed: false, job: saved.data };
  }
  if (job.status !== "failed" || !Number.isFinite(age) || age < 60000) return { claimed: false, job };
  const updated = await withFacebookDeadline(server.from("facebook_listing_posts")
    .update({ status: "processing", claim_token: token, page_id: pageId, message: "", post_id: null, attempts: (job.attempts || 1) + 1, updated_at: timestamp })
    .eq("listing_id", key).eq("owner_id", userId).eq("status", "failed")
    .eq("claim_token", job.claim_token).eq("updated_at", job.updated_at).select(jobFields).maybeSingle(), deadline);
  if (updated.error) throw Error("Could not reserve the retry.");
  return updated.data ? { claimed: true, job: updated.data } : { claimed: false, job: { status: "processing" } };
}

export async function handleUSAItemPublish(request, { env, createClient, fetchImpl = fetch, databaseTimeoutMs = 8000 }) {
  try {
    const authorization = request.headers.get("authorization") || "";
    if (!/^Bearer \S+$/i.test(authorization)) return json({ message: "Sign in to post a USA item." }, 401);
    const url = env.NEXT_PUBLIC_SUPABASE_URL, anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return json({ message: "The website database connection is not configured." }, 503);
    const client = createClient(url, anonKey, { ...clientOptions, global: { headers: { Authorization: authorization } } });
    const auth = await withFacebookDeadline(client.auth.getUser(authorization.slice(7)), databaseTimeoutMs);
    if (auth.error || !auth.data?.user) return json({ message: "Sign in again before posting." }, 401);
    const admin = await withFacebookDeadline(client.rpc("is_marketplace_admin"), databaseTimeoutMs);
    if (admin.error || admin.data !== true) return json({ message: "Administrator access required." }, 403);
    let body;
    try { body = await request.json(); } catch { return json({ message: "Invalid USA item request." }, 400); }
    if (!usaItemId(body?.itemId)) return json({ message: "Invalid USA item ID." }, 400);
    const userId = auth.data.user.id;
    const readItem = () => withFacebookDeadline(client.from("usa_shopping_items").select(usaItemFields)
      .eq("id", body.itemId).eq("admin_id", userId).eq("status", "published").maybeSingle(), databaseTimeoutMs);
    const initial = await readItem();
    if (initial.error) return json({ message: "Could not check this USA item. Refresh before retrying." }, 503);
    if (!publishable(initial.data, body.itemId, userId)) return json({ message: "Only your own published USA items can be posted." }, 403);
    const pageId = env.FACEBOOK_PAGE_ID, pageToken = env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const version = env.FACEBOOK_GRAPH_API_VERSION || "v26.0";
    if (!/^\d+$/.test(pageId || "") || !pageToken || !/^v\d+\.\d+$/.test(version) || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json({ message: "Configure the existing Facebook Page credentials in Hostinger before posting." }, 503);
    }
    const server = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, clientOptions);
    const reservation = await claimUSAItemPost(server, { itemId: body.itemId, userId, pageId, deadline: databaseTimeoutMs });
    const job = reservation.job;
    if (!reservation.claimed) {
      if (job.status === "published") return json({ status: "published", postId: job.post_id, message: "This USA item is already posted to Facebook." });
      return json({ status: job.status, message: job.status === "uncertain" ? uncertainMessage
        : "This item is being posted, or is waiting before a retry. Refresh posting status shortly." }, 409);
    }
    const finish = (status, postId, message) => withFacebookDeadline(server.rpc("finish_facebook_listing_post", {
      p_listing_id: usaFacebookJobId(body.itemId), p_claim_token: job.claim_token,
      p_status: status, p_post_id: postId, p_message: message,
    }), databaseTimeoutMs);
    // Reread with the caller's RLS after reserving; don't post a draft, a hidden
    // card, stale details, or an item after administrator access was revoked.
    const [latest, stillAdmin] = await Promise.all([readItem(), withFacebookDeadline(client.rpc("is_marketplace_admin"), databaseTimeoutMs)]);
    if (latest.error || stillAdmin.error || stillAdmin.data !== true || !publishable(latest.data, body.itemId, userId)) {
      const message = "The USA item or your access changed. Refresh before posting.";
      await finish("failed", null, message);
      return json({ status: "failed", message }, 409);
    }
    // Only public item fields form the caption, never private quote requests.
    const item = Object.fromEntries(publicUSAItemFields.split(",").map(key => [key, latest.data[key]]));
    const photo = server.storage.from("listing-photos").getPublicUrl(item.image_path).data.publicUrl;
    const parameters = new URLSearchParams({ url: photo, caption: usaItemCaption(item) });
    let status = "uncertain", postId = null, message = uncertainMessage;
    try {
      const response = await fetchImpl(`https://graph.facebook.com/${version}/${pageId}/photos`, {
        method: "POST", headers: { Authorization: `Bearer ${pageToken}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: parameters.toString(), signal: AbortSignal.timeout(20000), redirect: "error", cache: "no-store",
      });
      const result = await response.json();
      if (response.ok && /^\d+(?:_\d+)?$/.test(String(result.post_id || result.id || ""))) {
        status = "published"; postId = String(result.post_id || result.id); message = "USA item posted to Facebook.";
      } else if (response.status < 500 && result.error) {
        status = "failed"; message = facebookRejectionMessage(result.error, {
          secrets: [pageToken, env.SUPABASE_SERVICE_ROLE_KEY, env.FACEBOOK_APP_SECRET, authorization.slice(7)],
        });
      }
    } catch { /* Never automatically retry an uncertain initial publication. */ }
    const saved = await finish(status, postId, message);
    if (saved.error || saved.data !== true) return json({ status: "uncertain", message: uncertainMessage }, 503);
    return json({ status, postId, message }, status === "published" ? 200 : status === "failed" ? 422 : 409);
  } catch { return json({ message: `Could not confirm the request. Refresh posting status. ${uncertainMessage}` }, 503); }
}
