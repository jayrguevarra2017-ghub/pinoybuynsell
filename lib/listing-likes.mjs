export function listingLikeId(value) {
  if(typeof value==="number" && !Number.isSafeInteger(value)) return null;
  const id=String(value);
  return /^[1-9]\d{0,18}$/.test(id) && BigInt(id)<=9223372036854775807n ? id : null;
}

export async function likesRequest(operation,timeoutMs=10000) {
  let timer;
  try {
    const result=await Promise.race([operation,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Error("Like request not confirmed. Refresh likes to check before trying again.")),timeoutMs);
    })]);
    if(result?.error) throw Error("Likes are temporarily unavailable. Please try again later.");
    return result?.data;
  } finally {clearTimeout(timer);}
}

export function parseListingLikes(rows,ids) {
  if(!Array.isArray(rows)) throw Error("Likes are temporarily unavailable.");
  const allowed=new Set(ids),result=new Map();
  for(const row of rows) {
    if(!row || !allowed.has(row.listing_id) || result.has(row.listing_id)
      || !Number.isSafeInteger(row.like_count) || row.like_count<0 || typeof row.liked!=="boolean")
      throw Error("Likes are temporarily unavailable.");
    result.set(row.listing_id,{count:row.like_count,liked:row.liked,loaded:true,busy:false,error:null});
  }
  return result;
}

const initial=Object.freeze({count:null,liked:false,loaded:false,busy:false,error:null});

// One shared store batches visible cards and keeps duplicate instances in sync.
// Writes are confirmed before hearts/counts change; interrupted writes only
// refresh on request, never automatically repeat a mutation.
export function createListingLikesStore({read,write,batchDelayMs=20}) {
  const records=new Map(),listeners=new Map(),versions=new Map(),pending=new Set();
  let enabled=false,disposed=false,timer=null;
  const get=id=>records.get(id)||initial;
  function put(id,state){if(disposed)return;records.set(id,state);listeners.get(id)?.forEach(fn=>fn());}
  function bump(id){const n=(versions.get(id)||0)+1;versions.set(id,n);return n;}
  function refresh(id){
    if(disposed || !enabled || !listingLikeId(id) || get(id).busy)return;
    bump(id);pending.add(id);put(id,{...get(id),loaded:false,error:null});
    if(timer===null)timer=setTimeout(()=>{timer=null;flush();},batchDelayMs);
  }
  async function flush(){
    const ids=[...pending].slice(0,100);ids.forEach(id=>pending.delete(id));
    if(!ids.length || disposed || !enabled)return;
    const requested=new Map(ids.map(id=>[id,versions.get(id)]));
    try {
      const result=parseListingLikes(await read(ids),ids);
      for(const id of ids)if(versions.get(id)===requested.get(id))
        put(id,result.get(id)||{...initial,error:"This listing is unavailable."});
    }catch(error){
      for(const id of ids)if(versions.get(id)===requested.get(id))
        put(id,{...initial,error:error.message||"Likes are temporarily unavailable."});
    }
    if(pending.size && !disposed && timer===null)timer=setTimeout(()=>{timer=null;flush();},batchDelayMs);
  }
  return {
    get,
    subscribe(id,fn){
      if(!listeners.has(id))listeners.set(id,new Set());listeners.get(id).add(fn);
      if(!get(id).loaded && !get(id).error && !get(id).busy && !pending.has(id))refresh(id);
      return ()=>{listeners.get(id)?.delete(fn);if(!listeners.get(id)?.size)listeners.delete(id);};
    },
    activate(ready){disposed=false;enabled=ready;if(ready)listeners.forEach((_v,id)=>refresh(id));},
    refresh,
    async toggle(id){
      const previous=get(id);
      if(disposed || !enabled || !listingLikeId(id) || !previous.loaded || previous.busy)return;
      const version=bump(id);pending.delete(id);put(id,{...previous,busy:true,error:null});
      try {
        const result=parseListingLikes([await write(id,!previous.liked)],[id]).get(id);
        if(versions.get(id)===version)put(id,result);
      }catch(error){
        if(versions.get(id)===version)put(id,{...initial,error:error.message||"Like change not confirmed. Refresh likes to check."});
      }
    },
    dispose(){disposed=true;clearTimeout(timer);timer=null;pending.clear();listeners.clear();versions.forEach((_v,id)=>bump(id));},
  };
}
