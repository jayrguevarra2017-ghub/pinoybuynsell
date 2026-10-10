"use client";
import {createContext,useContext,useEffect,useMemo} from "react";
import {supabase} from "@/lib/supabase";
import {createListingLikesStore,likesRequest} from "@/lib/listing-likes.mjs";

const LikesContext=createContext(null);
export function useListingLikes(){return useContext(LikesContext);}

export default function ListingLikesProvider({children,userId,ready,online}) {
  // New identity = new store. Late responses from the old account are discarded.
  const store=useMemo(()=>createListingLikesStore({
    read:ids=>likesRequest(supabase.rpc("marketplace_listing_like_counts",{p_listing_ids:ids})),
    write:(id,liked)=>likesRequest(supabase.rpc("set_marketplace_listing_like",{p_listing_id:id,p_like:liked})),
  }),[userId]);
  useEffect(()=>{store.activate(ready && online);},[store,ready,online]);
  useEffect(()=>()=>store.dispose(),[store]);
  return <LikesContext.Provider value={store}>{children}</LikesContext.Provider>;
}
