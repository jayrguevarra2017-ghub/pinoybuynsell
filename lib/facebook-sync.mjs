import { facebookCaption, facebookRejectionMessage } from "./facebook-publishing.mjs";
import { validFacebookListingId, withFacebookDeadline } from "./facebook-posting.mjs";
import { editableFacebookPost, facebookSyncBusy, facebookSyncInProgress } from "./facebook-sync-state.mjs";

const json = (body, status=200) => Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const clientOptions = {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const fields = "listing_id,owner_id,page_id,status,post_id,message,claim_token,updated_at";

// UPDATE the saved Page post. Never call /feed or /photos, delete a post or
// change the original published status: retries cannot create duplicates.
export async function handleFacebookSync(request,{env,createClient,fetchImpl=fetch,databaseTimeoutMs=8000,graphTimeoutMs=20000,now=()=>Date.now(),newClaim=()=>crypto.randomUUID()}) {
  let server, job, claim;
  async function finish(status,message,httpStatus) {
    const saved = await withFacebookDeadline(server.from("facebook_listing_posts").update({message:message.slice(0,500),updated_at:new Date(now()).toISOString()})
      .eq("listing_id",job.listing_id).eq("owner_id",job.owner_id).eq("page_id",job.page_id)
      .eq("status","published").eq("claim_token",claim).eq("post_id",job.post_id).select("listing_id").maybeSingle(),databaseTimeoutMs);
    if(saved.error || !saved.data) return json({status:"uncertain",message:"The listing is saved, but the Facebook update status could not be confirmed. Check the post and use Update Facebook details."},503);
    return json({status,message,postId:job.post_id},httpStatus);
  }
  try {
    const authorization=request.headers.get("authorization") || "";
    if(!/^Bearer \S+$/i.test(authorization)) return json({message:"Sign in to update a Facebook post."},401);
    const url=env.NEXT_PUBLIC_SUPABASE_URL,publicKey=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if(!url || !publicKey) return json({message:"The website database connection is not configured."},503);
    const client=createClient(url,publicKey,{...clientOptions,global:{headers:{Authorization:authorization}}});
    const auth=await withFacebookDeadline(client.auth.getUser(authorization.slice(7)),databaseTimeoutMs);
    if(auth.error || !auth.data?.user) return json({message:"Sign in again before updating Facebook."},401);
    const admin=await withFacebookDeadline(client.rpc("is_marketplace_admin"),databaseTimeoutMs);
    if(admin.error || admin.data!==true) return json({message:"Administrator access required."},403);
    let body;try{body=await request.json();}catch{return json({message:"Invalid listing request."},400);}
    if(!validFacebookListingId(body?.listingId)) return json({message:"Invalid listing ID."},400);
    const readProduct=async()=>{
      const result=await withFacebookDeadline(client.from("products").select("*").eq("id",body.listingId)
        .eq("seller_id",auth.data.user.id).eq("status","active").is("deleted_at",null).maybeSingle(),databaseTimeoutMs);
      if(result.error) throw Error("Listing check unavailable.");
      return result.data?.seller_id===auth.data.user.id && result.data.status==="active" && !result.data.deleted_at ? result.data : null;
    };
    let product=await readProduct();
    if(!product) return json({message:"Only your own active listings can update a linked Facebook post."},403);
    if(!env.SUPABASE_SERVICE_ROLE_KEY) return json({message:"Facebook syncing requires the server database key in Hostinger."},503);
    server=createClient(url,env.SUPABASE_SERVICE_ROLE_KEY,clientOptions);
    const found=await withFacebookDeadline(server.from("facebook_listing_posts").select(fields)
      .eq("listing_id",body.listingId).eq("owner_id",auth.data.user.id).maybeSingle(),databaseTimeoutMs);
    if(found.error) return json({message:"Could not check the linked Facebook post. Refresh posting status."},503);
    job=found.data;
    if(!job) return json({status:"skipped",message:"No website-published Facebook post is linked to this listing."});
    if(job.owner_id!==auth.data.user.id || job.listing_id!==body.listingId) return json({message:"This Facebook post does not belong to your listing."},403);
    const pageId=env.FACEBOOK_PAGE_ID,token=env.FACEBOOK_PAGE_ACCESS_TOKEN,version=env.FACEBOOK_GRAPH_API_VERSION || "v26.0";
    if(!/^\d+$/.test(pageId || "") || !token || !/^v\d+\.\d+$/.test(version))
      return json({status:"failed",message:"The listing is saved. Configure the Facebook Page credentials in Hostinger to sync its post."},503);
    if(!editableFacebookPost(job,pageId)) return json({status:"blocked",message:"The listing is saved, but it has no confirmed editable post on the configured Page. Check its Facebook posting status."},409);
    if(facebookSyncBusy(job,now())) return json({status:"processing",message:"Another Facebook update is running. Refresh posting status shortly."},409);
    claim=newClaim();
    const reserved=await withFacebookDeadline(server.from("facebook_listing_posts")
      .update({claim_token:claim,message:facebookSyncInProgress,updated_at:new Date(now()).toISOString()})
      .eq("listing_id",job.listing_id).eq("owner_id",auth.data.user.id).eq("status","published")
      .eq("page_id",pageId).eq("post_id",job.post_id).eq("claim_token",job.claim_token).eq("updated_at",job.updated_at)
      .select("listing_id").maybeSingle(),databaseTimeoutMs);
    if(reserved.error) return json({status:"uncertain",message:"Could not confirm the Facebook update reservation. Refresh posting status before trying again."},503);
    if(!reserved.data) return json({status:"processing",message:"Another Facebook update changed this record. Refresh posting status shortly."},409);

    // Read after reserving, then recheck after each confirmed update. A second
    // website save during this request is coalesced into the same existing post.
    for(let pass=0;pass<3;pass++) {
      product=await readProduct();
      if(!product) return await finish("blocked","Facebook update not confirmed: this listing is no longer available. Review the existing post on Facebook.",409);
      const caption=facebookCaption(product);
      let response,result;
      try {
        ({response,result}=await withFacebookDeadline((async()=>{
          const response=await fetchImpl(`https://graph.facebook.com/${version}/${job.post_id}`,{
            method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/x-www-form-urlencoded"},
            body:new URLSearchParams({message:caption}).toString(),signal:AbortSignal.timeout(graphTimeoutMs),redirect:"error",cache:"no-store",
          });
          return {response,result:await response.json()};
        })(),graphTimeoutMs));
      } catch {
        return await finish("uncertain","Facebook update not confirmed: the request was interrupted. Check the post and use Update Facebook details to try again.",409);
      }
      if(!response.ok || (result!==true && result?.success!==true)) {
        if(response.status<500 && result?.error) return await finish("failed",`Facebook update failed: ${facebookRejectionMessage(result.error)}`,422);
        return await finish("uncertain","Facebook update not confirmed: check the post and use Update Facebook details to try again.",409);
      }
      const latest=await readProduct();
      if(latest && facebookCaption(latest)===caption) return await finish("synced","Facebook post details updated. Update any changed photo or link preview directly on Facebook.",200);
    }
    return await finish("pending","Facebook update not confirmed: the listing changed again while updating. Use Update Facebook details for its latest version.",409);
  } catch {
    // Original published status and post ID survive even if saving update
    // metadata fails. A stale update lock is retryable; UPDATE is idempotent.
    return json({status:"uncertain",message:"The listing is saved, but its Facebook update could not be confirmed. Refresh posting status and use Update Facebook details."},503);
  }
}
