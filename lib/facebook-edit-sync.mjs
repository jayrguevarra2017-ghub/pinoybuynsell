import { validFacebookListingId, withFacebookDeadline } from "./facebook-posting.mjs";

export async function updateFacebookDetails(client,listingId,{fetchImpl=fetch,timeoutMs=180000,sessionTimeoutMs=8000}={}) {
  if(!validFacebookListingId(listingId)) throw Error("Invalid listing ID.");
  const session=await withFacebookDeadline(client.auth.getSession(),sessionTimeoutMs);
  const token=session.data?.session?.access_token;
  if(session.error || !token) throw Error("Sign in again before updating Facebook.");
  const controller=new AbortController();let timer;
  try {
    return await Promise.race([(async()=>{
      const response=await fetchImpl("/api/facebook/sync",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        body:JSON.stringify({listingId}),signal:controller.signal,cache:"no-store"});
      const result=await response.json();
      if(!result || typeof result.message!=="string") throw Error("Could not confirm the Facebook update.");
      return result;
    })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error("Facebook updating timed out. Your listing is saved. Check the post and refresh posting status."));},timeoutMs);})]);
  }finally{clearTimeout(timer);}
}

// New listings never auto-publish. Ordinary sellers have no Page-publishing
// authority; edits only attempt a sync for an administrator's existing post.
export async function syncFacebookAfterEdit(client,listingId,options={}) {
  try {
    const admin=await withFacebookDeadline(client.rpc("is_marketplace_admin"),options.sessionTimeoutMs || 8000);
    if(admin.error) throw Error("Could not check Facebook access. Your listing is saved; check its Facebook posting status.");
    if(admin.data!==true) return {status:"skipped",message:"Listing saved."};
    return await updateFacebookDetails(client,listingId,options);
  }catch(error){return {status:"uncertain",message:error.message || "Your listing is saved, but the Facebook update could not be confirmed."};}
}
