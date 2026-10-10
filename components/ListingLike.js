"use client";
import {useCallback,useState,useSyncExternalStore} from "react";
import Link from "next/link";
import {useApp} from "@/components/AppProvider";
import {useListingLikes} from "@/components/ListingLikesProvider";
import {listingLikeId} from "@/lib/listing-likes.mjs";

const initial={count:null,liked:false,loaded:false,busy:false,error:null};
export default function ListingLike({listingId,title="item",overlay=false}) {
  const app=useApp(),store=useListingLikes(),id=listingLikeId(listingId),[guestMessage,setGuestMessage]=useState(false),[showError,setShowError]=useState(false);
  const subscribe=useCallback(fn=>id && store?store.subscribe(id,fn):()=>{},[id,store]);
  const snapshot=useCallback(()=>id && store?store.get(id):initial,[id,store]);
  const state=useSyncExternalStore(subscribe,snapshot,()=>initial);
  if(!id)return null;
  const label=state.error?`Refresh likes for ${title}`:state.busy?`Saving like for ${title}`:state.liked?`Unlike ${title}`:`Like ${title}`;
  return <div className={`listing-like${overlay?" listing-like-overlay":""}`}>
    <button type="button" className={`listing-heart${state.loaded && state.liked?" is-liked":""}`}
      aria-label={label} aria-pressed={state.loaded && state.liked} title={state.error||label}
      disabled={!app?.authReady || app?.online===false || state.busy || (!state.loaded && !state.error && Boolean(app?.user))}
      onClick={()=>{
        if(!app?.user){setGuestMessage(true);return;}
        setShowError(true);
        if(state.error)store.refresh(id);else store.toggle(id);
      }}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
      <span aria-hidden="true">{state.busy?"…":state.loaded?state.count.toLocaleString("en-PH"):"—"}</span>
      <span className="sr-only">{state.loaded?`${state.count} ${state.count===1?"like":"likes"}`:"Like count unavailable"}</span>
    </button>
    {guestMessage && !app?.user && <p className="listing-like-message" role="status"><Link href="/login">Sign in to like this item.</Link></p>}
    {state.error && showError && <p className="listing-like-message" role="status">{state.error}</p>}
  </div>;
}
